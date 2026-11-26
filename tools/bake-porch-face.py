"""Bake registered zombie turn drawings and three independent facial strips.

Usage: python tools/bake-porch-face.py original.puppet.json output.puppet.json
The source is the 16-cell Four on the Porch artwork from the first puppet release.
Requires Pillow, NumPy, SciPy and OpenCV. All sampling and registration are offline.
"""
import base64
import io
import json
import math
import sys
from pathlib import Path

import numpy as np
import cv2
from PIL import Image
from scipy.ndimage import map_coordinates
from scipy.spatial import Delaunay

TILE, COLUMNS, VIEWS, LEVELS = 128, 15, 49, 11
WIDTH, HEIGHT = 56, 34
Y, X = np.mgrid[:TILE, :TILE]
GRID = np.column_stack([X.ravel(), Y.ravel()])
BORDER = [(0,0),(64,0),(127,0),(127,64),(127,127),(64,127),(0,127),(0,64)]
# Profile, three-quarter, and front. Correspondences follow the skin, eye sockets,
# hair, ears, nose, mouth corners and neckline throughout the turn.
LANDMARKS = [
 [(61,6),(22,34),(88,29),(110,54),(102,87),(69,109),(56,122),(36,110),(21,98),(16,81),
  (23,64),(24,65),(24,77),(25,86),(36,63),(50,75),(40,89),(30,76),(22,86),
  (19,95),(28,96),(34,94),(26,103),(77,79),(61,41)],
 [(62,6),(17,39),(91,27),(111,53),(109,89),(76,108),(60,122),(33,108),(23,94),(23,82),
  (25,69),(31,65),(39,76),(32,88),(67,63),(79,75),(68,89),(56,75),(44,85),
  (34,94),(49,96),(65,93),(50,106),(100,80),(69,42)],
 [(65,6),(18,39),(91,26),(110,51),(119,87),(83,106),(64,122),(38,106),(24,94),(20,80),
  (32,73),(44,63),(56,74),(44,87),(85,62),(97,75),(85,87),(73,74),(64,84),
  (46,91),(64,94),(82,91),(64,105),(110,80),(78,41)]
]
# Eye centers and radii in each rest drawing. The far eye disappears behind the nose in profile.
EYES = [[(23,76,0,0),(32,76,8,11),(43,75,12,12)],
        [(39,76,11,12),(67,76,13,12),(85,75,12,12)]]
MOUTHS = [(26,98,8,6),(49,98,16,8),(64,97,18,9)]


def sample(pixels, x, y):
    return np.stack([map_coordinates(pixels[:,:,i], [y,x], order=1, mode='nearest')
                     for i in range(4)],axis=-1)


def pixels(image):
    a=np.asarray(image.convert('RGBA'),dtype=float)/255
    a[:,:,:3]*=a[:,:,3:]
    return a


def picture(a):
    a=np.clip(a,0,1).copy()
    a[:,:,:3]/=np.maximum(a[:,:,3:],1e-6)
    return Image.fromarray(np.uint8(np.clip(a*255+.5,0,255)))


def warp_pair(a,b,p,q,f):
    if f==0:return a
    if f==1:return b
    p=np.array(BORDER+list(p),float);q=np.array(BORDER+list(q),float)
    mesh=Delaunay(p*(1-f)+q*f)
    idx=mesh.find_simplex(GRID);matrix=mesh.transform[idx]
    uv=np.einsum('ijk,ik->ij',matrix[:,:2],GRID-matrix[:,2])
    weights=np.column_stack([uv,1-uv.sum(axis=1)])
    def warped(img,pts):
        xy=np.einsum('ij,ijk->ik',weights,pts[mesh.simplices[idx]]).reshape(TILE,TILE,2)
        return sample(img,xy[:,:,0],xy[:,:,1])
    first,second=warped(a,p),warped(b,q)
    return first*(1-f)+second*f


def registered_turn(a,b,p,q):
    # Solve the same correspondence once for the entire arc. Re-triangulating and
    # re-estimating flow at every angle made fine features flutter between poses.
    p=np.array(BORDER+list(p),np.float32);q=np.array(BORDER+list(q),np.float32)
    mid=(p+q)*.5
    triangles=Delaunay(mid).simplices
    grid=np.float32(np.dstack([X,Y]))
    def coordinate_map(src,dst):
        result=grid.copy()
        for triangle in triangles:
            origin=src[triangle];target=dst[triangle]
            x,y,w,h=cv2.boundingRect(origin)
            xx,yy=np.meshgrid(np.arange(x,x+w),np.arange(y,y+h))
            local=np.float32(np.dstack([xx,yy]))
            mask=np.zeros((h,w),np.uint8)
            cv2.fillConvexPoly(mask,np.int32(np.round((origin-[x,y])*256)),1,shift=8)
            region=result[y:y+h,x:x+w]
            region[mask!=0]=cv2.transform(local,cv2.getAffineTransform(origin,target))[mask!=0]
        return result
    def remap(arr,coords,mode=cv2.INTER_LINEAR):
        return cv2.remap(arr,coords,None,mode,borderMode=cv2.BORDER_REPLICATE)
    map_a,map_b=coordinate_map(mid,p),coordinate_map(mid,q)
    def luminance(arr):
        rgb=arr[:,:,:3]+(1-arr[:,:,3:])*.18
        return np.uint8(np.clip(rgb@[.299,.587,.114],0,1)*255)
    # Local correspondence after the feature mesh keeps the scar, pupils,
    # individual hair locks and the outside edge on a single moving contour.
    flow=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    flow.setFinestScale(0)
    ga,gb=luminance(remap(a,map_a)),luminance(remap(b,map_b))
    forward=flow.calc(ga,gb,None);backward=flow.calc(gb,ga,None)
    def draw(f):
        if f==0:return a
        if f==1:return b
        center=coordinate_map(p*(1-f)+q*f,mid)
        def from_source(img,coordinates,motion,weight):
            at=center
            for _ in range(4):
                at=center-remap(motion,at)*weight
            # Compose all coordinate changes before sampling the original paint.
            return remap(img,remap(coordinates,at),cv2.INTER_LANCZOS4)
        first=from_source(a,map_a,forward,f)
        second=from_source(b,map_b,backward,1-f)
        w=f*f/(f*f+(1-f)*(1-f))
        return first*(1-w)+second*w
    return draw


def eye_overlay(closed,eye,left,right,amount,reference_x):
    cx,cy,rx,ry=eye
    if rx<1 or amount==0:return np.zeros((HEIGHT,WIDTH,4))
    u=(left-cx)/rx;v=(right-cy)/ry
    arc=np.sqrt(np.maximum(0,1-u*u))
    seam=.13+.14*u*u
    upper=-arc+(arc+seam)*amount
    lower=arc+(seam-arc)*amount
    upper_y=-1+(v+1)*(1+seam)/np.maximum(.05,upper+1)
    lower_y=1-(1-v)*(1-seam)/np.maximum(.05,1-lower)
    tex=sample(closed,reference_x+u*12,75+np.clip(np.where(v<seam,upper_y,lower_y),-1.1,1.1)*12)
    covered=np.maximum((upper-v)*ry+.5,(v-lower)*ry+.5)
    edge=np.clip((1.06-np.hypot(u,v))*10,0,1)
    return tex*(edge*np.clip(covered,0,1))[:,:,None]


def mouth_overlay(head,whistle,mouth,left,top,amount):
    cx,cy,rx,ry=mouth
    if amount==0:return np.zeros((HEIGHT,WIDTH,4))
    # Warp both lip contours onto the same intermediate opening. The teeth move
    # inward with the corners and the final lip texture replaces them at closure.
    end_x=6.8*min(1,rx/15);end_y=6.4
    end_cy=cy-.8
    def anchors(x,y,w,h):
        return [(x-w,y-h*.65),(x,y-h*.52),(x+w,y-h*.65),(x+w*.58,y+h*.65),
                (x,y+h),(x-w*.58,y+h*.65),(x,y)]
    region=[(cx-1.48*rx,cy-1.85*ry),(cx+1.48*rx,cy-1.85*ry),
            (cx+1.48*rx,cy+1.85*ry),(cx-1.48*rx,cy+1.85*ry)]
    target=sample(whistle,64+(X-cx)*6.8/end_x,97+(Y-end_cy)*6.4/end_y)
    m=warp_pair(head,target,region+anchors(cx,cy,rx,ry),region+anchors(cx,end_cy,end_x,end_y),amount)
    # Use the rest face just outside the mouth to keep cheeks and the profile silhouette stationary.
    strength=np.clip((1.42-np.hypot((left-cx)/(rx+1),(top-cy)/(ry+1)))*4.5,0,1)
    loc=(np.clip(top,0,127),np.clip(left,0,127))
    m=m[loc];return m*(strength*head[loc][:,:,3])[:,:,None]


def far_face_projection(profile,quarter):
    """Reveal one painted eye from behind the face contour as the skull turns."""
    contours=[np.argmax(im[:,:,3]>.5,axis=1) for im in (profile,quarter)]
    # Remove the eye from the cheek plate before projecting it. Projecting the
    # socket together with the nose or ear would shear the pupil at the outline.
    socket=((X-32)/12)**2+((Y-76)/16)**2<1
    clean=quarter.copy()
    for c in range(3):
        rgb=np.uint8(np.clip(quarter[:,:,c]/np.maximum(.001,quarter[:,:,3]),0,1)*255)
        clean[:,:,c]=cv2.inpaint(rgb,np.uint8(socket),4,cv2.INPAINT_TELEA)/255*quarter[:,:,3]
    def eye_uv(x,y,f):
        opened=np.clip((f-.14)/.86,0,1)
        radius=10.5*opened
        center=22+10*opened
        u=(x-center)/max(radius,.06);v=(y-76)/15
        exposed=.35+.65*min(1,opened/.7)
        sx=32+10.5*(1-(1-u)*exposed)
        coverage=np.clip((1.04-np.hypot(u,v))*min(radius,9),0,1)
        return sx,coverage
    def coordinates(x,y,f):
        row=np.clip(y,0,TILE-1).astype(int)
        left=contours[0][row]*(1-f)+contours[1][row]*f
        # In profile the far socket is occluded. Reveal a progressively wider
        # slice of the quarter drawing, without fading a second pupil onto skin.
        hidden=np.interp(y,[42,60,71,83,91,100,112],[43,43,42,43,49,48,43])
        first=hidden*(1-f)+contours[1][row]*f
        edge_a=np.interp(y,[44,62,77,86,95,110],[52,38,37,42,51,52])
        edge_b=np.interp(y,[44,62,77,86,95,110],[77,66,65,69,77,78])
        edge=edge_a*(1-f)+edge_b*f
        u=np.maximum(0,(x-left)/np.maximum(1,edge-left))
        sx=first+(edge_b-first)*u**(1-.23*(1-f))
        coverage=np.clip(x-left+.5,0,1)
        return sx,coverage
    def skin(frame,f):
        if f==0 or f==1:return frame
        sx,coverage=coordinates(X,Y,f)
        # Seam sits between the eyes and out on the cheek alongside the smile.
        a=np.interp(Y,[43,60,72,83,90,98,109],[32,27,24,26,40,46,45])
        b=np.interp(Y,[43,60,72,83,90,98,109],[48,51,51,52,63,74,69])
        seam=a*(1-f)+b*f
        weight=np.clip((seam-X)/3+.5,0,1)*np.clip((Y-40)/9,0,1)*np.clip((112-Y)/8,0,1)
        weight*=min(1,f*12)
        rgba=cv2.remap(clean,np.float32(np.dstack([sx,Y])),None,cv2.INTER_LANCZOS4,
                       borderMode=cv2.BORDER_REPLICATE)
        eye_x,eye_mask=eye_uv(X,Y,f)
        eye=cv2.remap(quarter,np.float32(np.dstack([eye_x,Y])),None,cv2.INTER_LANCZOS4,
                      borderMode=cv2.BORDER_REPLICATE)
        rgba=(rgba*(1-eye_mask[:,:,None])+eye*eye_mask[:,:,None])*coverage[:,:,None]
        return frame*(1-weight[:,:,None])+rgba*weight[:,:,None]
    return skin,eye_uv


def lower_body_motion(doc):
    tracks=doc['clip']['tracks']
    # Small knee dip on the wave, with the opposite boot carrying the weight.
    dip=[(0,0),(1.02,0),(1.82,8),(2.44,4),(3.18,10),(4.04,6),(4.82,0),(6.8,0)]
    for joint,factor in [('rightHip',-1),('rightKnee',2),('rightFoot',-1)]:
        tracks[joint+'.rotation']=[[t,factor*value,'smooth'] for t,value in dip]
    for joint in ('leftHip','leftKnee','leftFoot'):
        tracks[joint+'.rotation']=[[0,0,'smooth']]
    for joint,raised in [('leftShoulder',4.5),('leftElbow',7),('leftHand',9)]:
        tracks[joint+'.depth']=[[0,0,'step'],[.87,raised,'step'],[5.25,0,'step']]


def fit_body(doc,tiles):
    """Register continuous paintings in joint-local space, including material behind each bend."""
    folder=Path(__file__).resolve().parents[1]/'examples/characters/porch-zombie-art'
    anatomy=pixels(Image.open(folder/'trousers-arm.webp'))
    costume=pixels(Image.open(folder/'shirts-hands.webp'))
    parts={p['id']:p for p in doc['parts']}
    pelvis=dict(id='pelvis',parent='body',x=0,y=6.5,rotation=0,pivot=0,size=1.25,
                depth=4,image='trousers',variants=[])
    doc['parts'].insert(2,pelvis)
    def local(p):
        scale=9*p['size']/TILE
        return (X-63.5)*scale,(Y-63.5)*scale
    def mask(arr,alpha):
        return arr*np.clip(alpha,0,1)[:,:,None]
    def trousers(p,side=None):
        x,y=local(p);a=math.radians(p['rotation'])
        wx=p['x']+x*math.cos(a)-y*math.sin(a)
        wy=p['y']+y*math.cos(a)+x*math.sin(a)-(5.8 if side else 0)
        sy=20+(wy-2.15)/.0198
        sx=568+wx/np.interp(sy,[20,400,810],[.016,.019,.021])
        paint=sample(anatomy,sx,sy)
        if not side:return mask(paint,(348-sy)/78)
        leg=mask(paint,(sx<568) if side=='left' else (sx>=568))
        axis=np.interp(sy,[200,415,775],[443,411,380]) if side=='left' else np.interp(sy,[200,415,775],[690,720,754])
        cap=np.sqrt(np.maximum(0,1-((sx-axis)/94)**2))
        if p['id'].endswith('Hip'):
            return mask(leg,np.clip((sy-258+67*cap)/28,0,1)*np.clip((424+60*cap-sy)/22,0,1))
        if p['id'].endswith('Knee'):
            return mask(leg,np.clip((sy-424+68*cap)/30,0,1)*np.clip((817-sy)/28,0,1))
        return mask(leg,np.clip((sy-761+30*cap)/22,0,1))
    tiles['trousers']=trousers(pelvis)
    def pivot(p):
        a=math.radians(p['rotation']);dy=p['pivot']*p['size']
        return np.array([p['x']-math.sin(a)*dy,p['y']+math.cos(a)*dy])
    def axis_coords(p,end):
        v=pivot(end)-pivot(p);length=np.linalg.norm(v);dx,dy=v/length
        x,y=local(p);y=y-p['pivot']*p['size'];a=math.radians(p['rotation'])
        wx=x*math.cos(a)-y*math.sin(a);wy=y*math.cos(a)+x*math.sin(a)
        return wx*dy-wy*dx,wx*dx+wy*dy,length
    for side in ('left','right'):
        for suffix,depth in [('Hip',2),('Knee',3),('Foot',1)]:
            p=parts[side+suffix]
            if suffix=='Hip':p['parent']='pelvis';p['pivot']=-1.1
            if suffix=='Knee':p['pivot']=-2.55
            p['depth']=depth;p['image']=side+suffix
            tiles[p['image']]=trousers(p,side)
        # Register skin in the lowered pose before moving its animation pivot.
        parts[side+'Shoulder']['pivot']=-.8
        for suffix,end,lo,hi in [('Shoulder','Elbow',202,397),('Elbow','Hand',397,675)]:
            p=parts[side+suffix];across,along,length=axis_coords(p,parts[side+end])
            sy=lo+(hi-lo)*along/length
            cx=np.interp(sy,[82,397,675],[1204,1181,1203])
            sx=cx+across/(.016 if side=='left' else -.016)
            # Round each hidden end to the radius of the rotating socket.
            cap=np.sqrt(np.maximum(0,1-(across/1.1)**2))
            alpha=np.clip((length+.85*cap-along)*12,0,1)
            if suffix=='Elbow':alpha*=np.clip((along+.83*cap)*5,0,1)
            p['image']=side+suffix;p['depth']=4.5 if suffix=='Shoulder' else 7
            if suffix=='Shoulder':
                # The near arm also passes in front of the shirt in profile.
                # Keep its top inside the dark cuff opening there.
                start=.52-.35*cap if side=='right' else -1.05*cap
                alpha*=np.clip((along-start)*8,0,1)
            skin=mask(sample(anatomy,sx,sy),alpha)
            tiles[p['image']]=skin
    palm=parts['leftHand'];x,y=local(palm);along=y-palm['pivot']*palm['size']
    palm_paint=pixels(Image.open(folder/'wave.webp'))
    tiles['palm']=mask(sample(palm_paint,283-x/.014,132+along/.0113),(along+.42)*5)
    hand=parts['rightHand'];x,y=local(hand);along=y-hand['pivot']*hand['size']
    for name,cx in [('fist',276),('uncurl',752),('four',1249)]:
        tiles[name]=mask(sample(costume,cx+x/.015,674+along/.020),(along+.45)*4)
    # Put the shoulders under the sleeves and keep the neck tucked into the head.
    shirts=[]
    for cx in [279,753,1253]:
        sx=cx+(X-63.5)*3.02;sy=256+(Y-63.5)*2.88
        shirt=sample(costume,sx,sy)
        skin=(shirt[:,:,1]-shirt[:,:,0])/(shirt[:,:,3]+1e-6)
        shirts.append(mask(shirt,1-(sy>345)*np.clip((skin+.005)*30,0,1)))
    tracks=doc['clip']['tracks']
    for side,inset in [('left',2.08),('right',-2.08)]:
        for key in tracks[side+'Shoulder.x']:key[1]+=inset
        tracks[side+'Shoulder.y']=[[0,-1.0]]
        parts[side+'Shoulder']['pivot']=-3.1
    # In profile the near arm emerges over the shirt, immediately inside its cuff.
    tracks['rightShoulder.depth']=[[0,6,'step'],[.65,4.5,'step'],[5.99,6,'step']]
    for key in tracks['rightShoulder.x']:
        if key[0] in (0,6.8):key[1]-=.25
    # Counter-rotate the pelvis. The support feet stay planted as the chest leans.
    tracks['pelvis.rotation']=[[t,-angle] for t,angle in tracks['body.rotation']]
    tracks['body.x']=[[t,pelvis['y']*math.sin(math.radians(angle))] for t,angle in tracks['body.rotation']]
    tracks['body.y']=[[t,pelvis['y']*(1-math.cos(math.radians(angle)))] for t,angle in tracks['body.rotation']]
    lower_body_motion(doc)
    return shirts


def shirt_skin():
    # Weights are painted in shirt space. The cuff follows the humerus, the
    # armhole shares the bend, and the collar, patch and waistband stay pinned.
    intervals=16
    y,x=np.mgrid[0:TILE+1:8,0:TILE+1:8]
    def ramp(value):
        u=np.clip(value,0,1)
        return u*u*(3-2*u)
    views=[]
    for index in range(VIEWS):
        view=index/(VIEWS-1)
        def at(profile,quarter,front):
            return float(np.interp(view,[0,.5,1],[profile,quarter,front]))
        # Rest sockets are in the same tile coordinates as the arm joints.
        pivots=[[at(70,50,29),36],[at(54,81,99),36]]
        # The sewn armhole curves outward at the armpit. Pin the chest-side
        # stitches below it; pulling them with the cuff smears the embroidery.
        curve=ramp((y-48)/33)*11
        seam_left=at(32,29,35)-curve;seam_right=at(48,81,93)+curve
        lower=ramp((86-y)/12)
        top=ramp((y-15)/22)
        left=ramp((seam_left-x)/18+.48)*lower*top*at(0,.80,1)
        right=ramp((x-seam_right)/18+.48)*lower*top
        # The profile sleeve lies diagonally across the side of the chest.
        right*=ramp((at(91,125,154)-x)/14)
        weights=np.uint8(np.round(np.stack([left,right],axis=2)*255))
        views.append(dict(pivots=pivots,weights=base64.b64encode(weights.tobytes()).decode()))
    return dict(viewChannel='view',joints=['leftShoulder','rightShoulder'],intervals=intervals,views=views)


def bake(doc):
    old=Image.open(io.BytesIO(base64.b64decode(doc['atlas']['src'].split(',')[1])))
    names=doc['atlas']['images']
    def cell(name):
        i=names.index(name);x=i%4*TILE;y=i//4*TILE
        return pixels(old.crop((x,y,x+TILE,y+TILE)))
    heads=[cell(n) for n in ['profile','threeQuarter','front']]
    far_skin,far_uv=far_face_projection(heads[0],heads[1])
    closed,whistle=cell('blink'),cell('whistle')
    slots=['rightEyelid','leftEyelid','mouth']
    tiles={n:cell(n) for n in names if n not in ['blink','whistle','blinkWhistle','arm','leg','foot']}
    shirts=fit_body(doc,tiles)
    frames=[];layers=[dict(channel=k,label=l,viewChannel='view',emptyValue=0,width=WIDTH,height=HEIGHT,views=[])
                       for k,l in zip(slots,['Right eyelid','Left eyelid','Whistle'])]
    body,head=doc['parts'][:2];head['layers']=layers
    body['skin']=shirt_skin()
    head['variants']=[];body['variants']=[]
    shirt_marks=[[(64,16),(67,56),(45,73),(51,106),(79,104)],[(64,16),(93,55),(31,70),(41,104),(84,105)],[(64,16),(101,53),(28,66),(35,102),(87,104)]]
    turns=[[registered_turn(img[i],img[i+1],marks[i],marks[i+1]) for i in range(2)]
           for img,marks in [(heads,LANDMARKS),(shirts,shirt_marks)]]
    for i in range(VIEWS):
        half=(VIEWS-1)//2
        pair=min(i//half,1);f=(i-pair*half)/half
        def between(values):
            return np.array(values[pair])*(1-f)+np.array(values[pair+1])*f
        face=np.clip(turns[0][pair](f),0,1)
        if pair==0:face=far_skin(face,f)
        for part,arr,key,rest in [(head,face,'headTurn',['profile','threeQuarter','front']),
                                  (body,turns[1][pair](f),'shirtTurn',['torsoProfile','torsoQuarter','torso'])]:
            name=rest[i//half] if i%half==0 else key+str(i)
            tiles[name]=arr;part['variants'].append(dict(image=name,when={'view':i}))
        frames.append((face,[between(EYES[0]),between(EYES[1]),between(MOUTHS)]))
    base_rows=math.ceil(len(tiles)/COLUMNS)
    strips_per_row=COLUMNS*TILE//(LEVELS*WIDTH)
    atlas=Image.new('RGBA',(COLUMNS*TILE,base_rows*TILE+math.ceil(len(slots)*VIEWS/strips_per_row)*HEIGHT))
    for i,arr in enumerate(tiles.values()):
        atlas.paste(picture(arr),((i%COLUMNS)*TILE,(i//COLUMNS)*TILE))
    yy,xx=np.mgrid[:HEIGHT,:WIDTH]
    for vi,(face,features) in enumerate(frames):
        for ch,(layer,feature) in enumerate(zip(layers,features)):
            left=round(feature[0]-WIDTH/2);top=round(feature[1]-HEIGHT/2)
            row,column=divmod(ch*VIEWS+vi,strips_per_row)
            x=column*LEVELS*WIDTH;y=base_rows*TILE+row*HEIGHT
            layer['views'].append(dict(x=x,y=y,left=left,top=top))
            for step in range(1,LEVELS):
                amount=step/(LEVELS-1)
                if ch==2:
                    patch=mouth_overlay(face,whistle,feature,xx+left,yy+top,amount)
                elif ch==0 and 0<vi<(VIEWS-1)//2:
                    sx,visible=far_uv(xx+left,yy+top,vi/((VIEWS-1)//2))
                    patch=eye_overlay(closed,EYES[0][1],sx,yy+top,amount,43)*visible[:,:,None]
                else:
                    patch=eye_overlay(closed,feature,xx+left,yy+top,amount,43 if ch==0 else 85)
                atlas.paste(picture(patch),(x+step*WIDTH,y))
    out=io.BytesIO();atlas.save(out,'WEBP',quality=93,method=5,alpha_quality=100)
    doc['atlas']=dict(tile=TILE,columns=COLUMNS,height=atlas.height,images=list(tiles),src='data:image/webp;base64,'+base64.b64encode(out.getvalue()).decode())
    doc['interpolated']=['view',*slots];channels=doc['channels'];del channels['blink']
    channels['view']=['Profile',*[f'Angle {i+1} of {VIEWS}' for i in range(1,VIEWS-1)],'Front']
    channels['view'][(VIEWS-1)//2]='Three-quarter'
    for name in slots:
        labels=['Smile','Whistle'] if name=='mouth' else ['Open','Closed']
        channels[name]=[labels[0],*[str(n*10)+'%' for n in range(1,10)],labels[1]]
    tracks=doc['clip']['tracks'];del tracks['blink']
    def smooth(keys):return [[t,v,'smooth'] for t,v in keys]
    tracks['view']=[[0,0,'step'],[.13,0,'linear'],[.20,2,'linear'],[.97,46,'linear'],
                    [1.04,48,'step'],[5.62,48,'linear'],[5.69,46,'linear'],[6.46,2,'linear'],
                    [6.53,0,'step'],[6.8,0,'step']]
    for name,offset in [('rightEyelid',0),('leftEyelid',.023)]:
        tracks[name]=smooth([(0,0),(1.15+offset,0),(1.30+offset,10),(1.34+offset,10),(1.54+offset,0),
                             (4.22+offset,0),(4.37+offset,10),(4.41+offset,10),(4.61+offset,0),(6.8,0)])
    tracks['mouth']=smooth([(0,0),(3.52,0),(3.98,10),(4.77,10),(5.20,0),(6.8,0)])
    return doc


if __name__=='__main__':
    source,output=map(Path,sys.argv[1:])
    output.write_text(json.dumps(bake(json.loads(source.read_bytes())),indent=2)+'\n',encoding='utf8')
