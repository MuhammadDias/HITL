// 2D placement bounds: canvas 800x380, groundY=320, object max width/height based on gapWidth+20
export function isLegalPlacement(x:number, y:number, width:number, height:number):boolean {
  return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x + width <= 800 && y + height <= 380;
}

export function worldOutcome(s:{phase:string;x:number;y:number;goal:number;grounded:boolean;hazard:boolean}):"success"|"fail"|null {
 if(s.phase!=="gameplay")return null;
 if(s.hazard||s.y>460)return "fail";
 return s.x>=s.goal && s.grounded ? "success":null;
}
