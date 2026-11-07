/** CSS-pixel viewport; world physics always remains 800 x 380. */
export function worldViewport(width:number,height:number,dpr=1){
 const w=Math.max(1,width),h=Math.max(1,height),scale=Math.min(w/800,h/380);
 return {width:w,height:h,scale,offsetX:(w-800*scale)/2,offsetY:(h-380*scale)/2,backingWidth:Math.round(w*dpr),backingHeight:Math.round(h*dpr)};
}
export function screenToWorld(x:number,y:number,v:ReturnType<typeof worldViewport>){return {x:(x-v.offsetX)/v.scale,y:(y-v.offsetY)/v.scale};}
