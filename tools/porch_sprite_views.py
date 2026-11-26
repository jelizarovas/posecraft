"""Orthographic, part-sized turntable frames for the painted Porch rig."""
import math
import numpy as np
import cv2



def register_back(front, back):
    """Fit reverse-side paint to the same finger cross sections as the palm."""
    back = back[:, ::-1]
    result = front.copy()
    rows = np.flatnonzero((front[:, :, 3] > .025).any(axis=1))
    back_rows = np.flatnonzero((back[:, :, 3] > .025).any(axis=1))
    for y, by in zip(rows, np.interp(rows, [rows[0], rows[-1]], [0, len(back_rows)-1])):
        paint = back[back_rows[round(by)]]
        source = np.flatnonzero(paint[:, 3] > .025)
        target = np.flatnonzero(front[y, :, 3] > .025)
        locations = np.linspace(0, len(source)-1, len(target))
        for channel in range(3):
            color = paint[source, channel] / paint[source, 3]
            result[y, target, channel] = np.interp(locations, np.arange(len(source)), color) * front[y, target, 3]
    return result


def turn_limb(front, degrees, thickness, back=None):
    # Cross sections follow the painted silhouette, including separate fingers.
    # Intersect each camera ray with an elliptical cross section, then transport
    # its painted surface coordinate and normal into the camera view.
    if not degrees:
        return front
    angle=math.radians(degrees)
    c,s=math.cos(angle),math.sin(angle)
    height,width=front.shape[:2]
    out=np.zeros_like(front)
    xx=np.arange(width)
    for y in range(height):
        mask=front[y,:,3]>.025
        bounds=np.flatnonzero(np.diff(np.r_[False,mask,False]))
        depth=np.full(width,-np.inf)
        for left,end in bounds.reshape(-1,2):
            radius=(end-left)/2
            cx=(end+left-1)/2
            shift=(cx-(width-1)/2)*c+(width-1)/2
            rz=radius*thickness
            if back is not None:
                # A finger is nearly round. A whole palm is wider but flatter.
                rz=min(.85*radius,.24*radius+.032*width)
            wide=math.hypot(radius*c,rz*s)
            u=(xx-shift)/max(.01,wide)
            v=np.sqrt(np.maximum(0,1-u*u))
            z=(rz*rz-radius*radius)*s*c/ wide*u+radius*rz/wide*v
            camera_z=z-(cx-(width-1)/2)*s
            keep=(abs(u)<1)&(camera_z>depth)
            if not keep.any():continue
            # Source X from the surface position, viewed straight on.
            sx=np.clip(cx+(xx[keep]-shift)*c-z[keep]*s,left,end-1)
            if back is not None:
                # At the edge-on bearing a ray can see the silhouette texel
                # along an entire finger. Sample its opaque neighbor for paint;
                # coverage comes from the projected cross section below.
                alpha=front[y,left:end,3]
                solid=np.flatnonzero(alpha>=.85*alpha.max())
                sx=np.clip(sx,left+solid[0],left+solid[-1])
            low=sx.astype(int);f=(sx-low)[:,None]
            rgba=(1-f)*front[y,low]+f*front[y,np.minimum(end-1,low+1)]
            if back is not None:
                reverse=(1-f)*back[y,low]+f*back[y,np.minimum(end-1,low+1)]
                surface_z=(xx[keep]-shift)*s+z[keep]*c
                palm_weight=np.clip(.5+surface_z/(.25*rz),0,1)[:,None]
                rgba=palm_weight*rgba+(1-palm_weight)*reverse
                rgba*=1+abs(s)*(alpha.max()/np.maximum(rgba[:,3:],.001)-1)
            rgba[:,:3]*=(1-.11*abs(s)*(1-v[keep]))[:,None]
            rgba*=np.clip((1-abs(u[keep]))*wide+.5,0,1)[:,None]
            out[y,keep]=rgba;depth[keep]=camera_z[keep]
    return out


def fit_porch_contacts(parts,tracks):
    parts['pelvis']['space']['collision'] = dict(spheres=[
        [-1.7, .1, 0, 2.1], [0, .6, 0, 2.3], [1.7, .1, 0, 2.1]])
    for side, facing in [('left', 'behind'), ('right', 'front')]:
        avoid = dict(target='pelvis', pivot=side+'Shoulder', side=facing)
        parts[side+'Elbow']['space']['collision'] = dict(avoid=avoid, spheres=[
            [0, .25, 0, 1.16], [0, 2.5, 0, 1.23], [0, 4.7, 0, 1.0]])
        parts[side+'Hand']['space']['collision'] = dict(avoid=avoid, spheres=[
            [0, .4, 0, 1.0], [0, 2.7, 0, 1.85], [0, 5.1, 0, 1.4]])
    # The far arm brushes the back pocket as the greeting settles.
    for axis,tail in [('rotation',[(5.18,-9),(5.66,-26),(5.98,-22),(6.53,0)]),
                      ('pitch',[(5.04,-10),(5.66,-42),(5.98,-35),(6.53,0)])]:
        key='leftShoulder.'+axis
        tracks[key]=[k for k in tracks[key] if k[0]<=4.7]+[[t,v,'smooth'] for t,v in tail]+[[6.8,0,'smooth']]
    for joint in ['leftElbow','leftHand']:
        tracks[joint+'.depth'][-1]=[4.65,0,'step']


def rig_and_drawings(doc,tiles,dorsal):
    tracks=doc['clip']['tracks']
    def keys(points):return [[t,v,'smooth'] for t,v in points]
    face=dict(channel='view',range=[-70,0])
    waist=dict(channel='hipTurn',range=[-14,5])
    rest_depth={'head':.12,'pelvis':-.18,'Shoulder':-.06,'Elbow':-.12,
                'Hand':.16,'Hip':.14,'Knee':.24,'Foot':.35}
    for part in doc['parts']:
        name=part['id']
        segment=name.removeprefix('left').removeprefix('right')
        space=part['space']={'z':rest_depth.get(segment,0)}
        if name in ('body','head','pelvis'):
            target=waist if name=='pelvis' else face
            space.update(aim=target,view=target)
        elif name.endswith('Shoulder'):
            space.update(aim={},view=dict(**face,joint='body'))
        else:
            if name.endswith('Hip'):space['aim']={}
            bases={part['image'],*(v['image'] for v in part['variants'])}
            waving=name=='leftHand'
            hand=name.endswith('Hand')
            angles=list(range(-180,181,15)) if hand or name.endswith('Elbow') else list(range(-60,61,15))
            bearings={}
            for base in sorted(bases):
                # Keep the counting pose's silhouette on the reverse side.
                # Soften nail/crease detail where the opposite palm is exposed.
                reverse=dorsal if waving else tiles[base]
                if hand and not waving:
                    flipped=tiles[base][:,::-1].copy()
                    soft=cv2.GaussianBlur(flipped,(0,0),2.5)
                    reverse=flipped.copy()
                    reverse[:,:,:3]=soft[:,:,:3]/np.maximum(soft[:,:,3:],.001)*flipped[:,:,3:]
                back_paint=register_back(tiles[base],reverse) if hand else None
                images=[]
                for deg in angles:
                    key=base if deg==0 else f'{base}Bearing{deg}'
                    if deg:
                        tiles[key]=turn_limb(tiles[base],deg,.43 if hand else .85,back_paint)
                    images.append(key)
                bearings[base]=images
            space['bearings']=dict(range=[angles[0],angles[-1]],images=bearings)
    foot=next(p for p in doc['parts'] if p['id']=='leftFoot')
    foot['space']['plant']=[0,-5.8,0]
    tracks['leftFoot.plant']=[[0,1,'step']]
    for joint in ('body','head','pelvis'):
        tracks[joint+'.yaw']=[[0,0,'linear']]
    for side,sign in [('left',-1),('right',1)]:
        tracks[side+'Shoulder.yaw']=keys([(0,-22),(.14,-22),(1.04,0),(5.62,0),(6.53,-22),(6.8,-22)])
        tracks[side+'Shoulder.pitch']=keys([(0,0),(1.1,0),(2,sign*7),(4.5,sign*5),(5.6,0),(6.8,0)])
        tracks[side+'Hip.yaw']=keys([(0,-15),(1.15,0),(3.1,sign*5),(5.62,0),(6.53,-15),(6.8,-15)])
    parts={p['id']:p for p in doc['parts']}
    for side in ('left','right'):
        left=side=='left'
        elbow=parts[side+'Elbow']['space']
        # Zero is the palm-down stop; palm-up is a single mirrored half turn.
        # Screen-left is the character's right. Its front drawing shows the palm;
        # the counting hand's front drawing shows the knuckles.
        elbow['twist']=dict(to=side+'Hand',neutral=180 if left else 0)
        elbow['limits']=dict(rotation=[0,145] if left else [-145,0],yaw=[0,0],pitch=[0,0],
                             twist=[-180,0] if left else [0,180])
        parts[side+'Hand']['space']['limits']=dict(rotation=[-25,25],pitch=[-65,65],yaw=[0,0])
        parts[side+'Knee']['space']['limits']=dict(rotation=[-135,0] if left else [0,135],yaw=[0,0],pitch=[0,0])
    tracks['leftElbow.twist']=keys([(0,0),(.6,0),(1.55,-147),(1.95,-180),(2.3,-157),(2.7,-172),(3.2,-180),(4.5,-180),(5.8,0),(6.8,0)])
    tracks['rightElbow.twist']=keys([(0,40),(1.15,0),(4.75,0),(6.53,40),(6.8,40)])
    fit_porch_contacts(parts,tracks)
