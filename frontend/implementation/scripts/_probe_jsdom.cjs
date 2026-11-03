const { JSDOM } = require("jsdom");
const d = new JSDOM("<!doctype html><html><body></body></html>");
console.log("PointerEvent:", typeof d.window.PointerEvent);
console.log("setPointerCapture:", typeof d.window.HTMLElement.prototype.setPointerCapture);
console.log("releasePointerCapture:", typeof d.window.HTMLElement.prototype.releasePointerCapture);
console.log("rAF:", typeof d.window.requestAnimationFrame);
console.log("gsap ver:", require("gsap/package.json").version);
