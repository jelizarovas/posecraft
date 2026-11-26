"""Orthographic, part-sized turntable frames for the painted Porch rig."""
import math
import numpy as np
import cv2



def turn_limb(front, degrees, thickness):
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
            wide=math.hypot(radius*c,rz*s)
            u=(xx-shift)/max(.01,wide)
            v=np.sqrt(np.maximum(0,1-u*u))
            z=(rz*rz-radius*radius)*s*c/ wide*u+radius*rz/wide*v
            keep=(abs(u)<1)&(z>depth)
            if not keep.any():continue
            # Source X from the surface position, viewed straight on.
            sx=np.clip(cx+(xx[keep]-shift)*c-z[keep]*s,left,end-1)
            low=sx.astype(int);f=(sx-low)[:,None]
            rgba=(1-f)*front[y,low]+f*front[y,np.minimum(end-1,low+1)]
            rgba[:,:3]*=(1-.11*abs(s)*(1-v[keep]))[:,None]
            rgba*=np.clip((1-abs(u[keep]))*wide+.5,0,1)[:,None]
            out[y,keep]=rgba;depth[keep]=z[keep]
    return out


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
                images=[]
                for deg in angles:
                    key=base if deg==0 else f'{base}Bearing{deg}'
                    if deg:
                        back=hand and abs(deg)>90
                        paint=reverse if back else tiles[base]
                        angle=deg-math.copysign(180,deg) if back else deg
                        tiles[key]=turn_limb(paint,angle,.43 if name.endswith('Hand') else .85)
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
        elbow['twist']=dict(to=side+'Hand',neutral=-180 if left else 180)
        elbow['limits']=dict(rotation=[0,145] if left else [-145,0],yaw=[0,0],pitch=[0,0],
                             twist=[0,180] if left else [-180,0])
        parts[side+'Hand']['space']['limits']=dict(rotation=[-25,25],pitch=[-65,65],yaw=[0,0])
        parts[side+'Knee']['space']['limits']=dict(rotation=[-135,0] if left else [0,135],yaw=[0,0],pitch=[0,0])
    tracks['leftElbow.twist']=keys([(0,0),(.6,0),(1.55,147),(1.95,180),(2.3,157),(2.7,172),(3.2,180),(4.5,180),(5.8,0),(6.8,0)])
    tracks['rightElbow.twist']=keys([(0,-140),(1.15,-180),(4.75,-180),(6.53,-140),(6.8,-140)])
