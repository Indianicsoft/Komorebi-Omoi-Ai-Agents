(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();function e(e,t,n,r){var i=arguments.length,a=i<3?t:r===null?r=Object.getOwnPropertyDescriptor(t,n):r,o;if(typeof Reflect==`object`&&typeof Reflect.decorate==`function`)a=Reflect.decorate(e,t,n,r);else for(var s=e.length-1;s>=0;s--)(o=e[s])&&(a=(i<3?o(a):i>3?o(t,n,a):o(t,n))||a);return i>3&&a&&Object.defineProperty(t,n,a),a}var t=globalThis,n=t.ShadowRoot&&(t.ShadyCSS===void 0||t.ShadyCSS.nativeShadow)&&`adoptedStyleSheets`in Document.prototype&&`replace`in CSSStyleSheet.prototype,r=Symbol(),i=new WeakMap,a=class{constructor(e,t,n){if(this._$cssResult$=!0,n!==r)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=e,this.t=t}get styleSheet(){let e=this.o,t=this.t;if(n&&e===void 0){let n=t!==void 0&&t.length===1;n&&(e=i.get(t)),e===void 0&&((this.o=e=new CSSStyleSheet).replaceSync(this.cssText),n&&i.set(t,e))}return e}toString(){return this.cssText}},o=e=>new a(typeof e==`string`?e:e+``,void 0,r),s=(e,...t)=>new a(e.length===1?e[0]:t.reduce((t,n,r)=>t+(e=>{if(!0===e._$cssResult$)return e.cssText;if(typeof e==`number`)return e;throw Error(`Value passed to 'css' function must be a 'css' function result: `+e+`. Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.`)})(n)+e[r+1],e[0]),e,r),c=(e,r)=>{if(n)e.adoptedStyleSheets=r.map(e=>e instanceof CSSStyleSheet?e:e.styleSheet);else for(let n of r){let r=document.createElement(`style`),i=t.litNonce;i!==void 0&&r.setAttribute(`nonce`,i),r.textContent=n.cssText,e.appendChild(r)}},l=n?e=>e:e=>e instanceof CSSStyleSheet?(e=>{let t=``;for(let n of e.cssRules)t+=n.cssText;return o(t)})(e):e,{is:u,defineProperty:d,getOwnPropertyDescriptor:ee,getOwnPropertyNames:te,getOwnPropertySymbols:ne,getPrototypeOf:re}=Object,f=globalThis,ie=f.trustedTypes,ae=ie?ie.emptyScript:``,oe=f.reactiveElementPolyfillSupport,p=(e,t)=>e,m={toAttribute(e,t){switch(t){case Boolean:e=e?ae:null;break;case Object:case Array:e=e==null?e:JSON.stringify(e)}return e},fromAttribute(e,t){let n=e;switch(t){case Boolean:n=e!==null;break;case Number:n=e===null?null:Number(e);break;case Object:case Array:try{n=JSON.parse(e)}catch{n=null}}return n}},se=(e,t)=>!u(e,t),ce={attribute:!0,type:String,converter:m,reflect:!1,useDefault:!1,hasChanged:se};Symbol.metadata??=Symbol(`metadata`),f.litPropertyMetadata??=new WeakMap;var h=class extends HTMLElement{static addInitializer(e){this._$Ei(),(this.l??=[]).push(e)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(e,t=ce){if(t.state&&(t.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(e)&&((t=Object.create(t)).wrapped=!0),this.elementProperties.set(e,t),!t.noAccessor){let n=Symbol(),r=this.getPropertyDescriptor(e,n,t);r!==void 0&&d(this.prototype,e,r)}}static getPropertyDescriptor(e,t,n){let{get:r,set:i}=ee(this.prototype,e)??{get(){return this[t]},set(e){this[t]=e}};return{get:r,set(t){let a=r?.call(this);i?.call(this,t),this.requestUpdate(e,a,n)},configurable:!0,enumerable:!0}}static getPropertyOptions(e){return this.elementProperties.get(e)??ce}static _$Ei(){if(this.hasOwnProperty(p(`elementProperties`)))return;let e=re(this);e.finalize(),e.l!==void 0&&(this.l=[...e.l]),this.elementProperties=new Map(e.elementProperties)}static finalize(){if(this.hasOwnProperty(p(`finalized`)))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(p(`properties`))){let e=this.properties,t=[...te(e),...ne(e)];for(let n of t)this.createProperty(n,e[n])}let e=this[Symbol.metadata];if(e!==null){let t=litPropertyMetadata.get(e);if(t!==void 0)for(let[e,n]of t)this.elementProperties.set(e,n)}this._$Eh=new Map;for(let[e,t]of this.elementProperties){let n=this._$Eu(e,t);n!==void 0&&this._$Eh.set(n,e)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(e){let t=[];if(Array.isArray(e)){let n=new Set(e.flat(1/0).reverse());for(let e of n)t.unshift(l(e))}else e!==void 0&&t.push(l(e));return t}static _$Eu(e,t){let n=t.attribute;return!1===n?void 0:typeof n==`string`?n:typeof e==`string`?e.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(e=>this.enableUpdating=e),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(e=>e(this))}addController(e){(this._$EO??=new Set).add(e),this.renderRoot!==void 0&&this.isConnected&&e.hostConnected?.()}removeController(e){this._$EO?.delete(e)}_$E_(){let e=new Map,t=this.constructor.elementProperties;for(let n of t.keys())this.hasOwnProperty(n)&&(e.set(n,this[n]),delete this[n]);e.size>0&&(this._$Ep=e)}createRenderRoot(){let e=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return c(e,this.constructor.elementStyles),e}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(e=>e.hostConnected?.())}enableUpdating(e){}disconnectedCallback(){this._$EO?.forEach(e=>e.hostDisconnected?.())}attributeChangedCallback(e,t,n){this._$AK(e,n)}_$ET(e,t){let n=this.constructor.elementProperties.get(e),r=this.constructor._$Eu(e,n);if(r!==void 0&&!0===n.reflect){let i=(n.converter?.toAttribute===void 0?m:n.converter).toAttribute(t,n.type);this._$Em=e,i==null?this.removeAttribute(r):this.setAttribute(r,i),this._$Em=null}}_$AK(e,t){let n=this.constructor,r=n._$Eh.get(e);if(r!==void 0&&this._$Em!==r){let e=n.getPropertyOptions(r),i=typeof e.converter==`function`?{fromAttribute:e.converter}:e.converter?.fromAttribute===void 0?m:e.converter;this._$Em=r;let a=i.fromAttribute(t,e.type);this[r]=a??this._$Ej?.get(r)??a,this._$Em=null}}requestUpdate(e,t,n,r=!1,i){if(e!==void 0){let a=this.constructor;if(!1===r&&(i=this[e]),n??=a.getPropertyOptions(e),!((n.hasChanged??se)(i,t)||n.useDefault&&n.reflect&&i===this._$Ej?.get(e)&&!this.hasAttribute(a._$Eu(e,n))))return;this.C(e,t,n)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(e,t,{useDefault:n,reflect:r,wrapped:i},a){n&&!(this._$Ej??=new Map).has(e)&&(this._$Ej.set(e,a??t??this[e]),!0!==i||a!==void 0)||(this._$AL.has(e)||(this.hasUpdated||n||(t=void 0),this._$AL.set(e,t)),!0===r&&this._$Em!==e&&(this._$Eq??=new Set).add(e))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(e){Promise.reject(e)}let e=this.scheduleUpdate();return e!=null&&await e,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[e,t]of this._$Ep)this[e]=t;this._$Ep=void 0}let e=this.constructor.elementProperties;if(e.size>0)for(let[t,n]of e){let{wrapped:e}=n,r=this[t];!0!==e||this._$AL.has(t)||r===void 0||this.C(t,void 0,n,r)}}let e=!1,t=this._$AL;try{e=this.shouldUpdate(t),e?(this.willUpdate(t),this._$EO?.forEach(e=>e.hostUpdate?.()),this.update(t)):this._$EM()}catch(t){throw e=!1,this._$EM(),t}e&&this._$AE(t)}willUpdate(e){}_$AE(e){this._$EO?.forEach(e=>e.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(e)),this.updated(e)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(e){return!0}update(e){this._$Eq&&=this._$Eq.forEach(e=>this._$ET(e,this[e])),this._$EM()}updated(e){}firstUpdated(e){}};h.elementStyles=[],h.shadowRootOptions={mode:`open`},h[p(`elementProperties`)]=new Map,h[p(`finalized`)]=new Map,oe?.({ReactiveElement:h}),(f.reactiveElementVersions??=[]).push(`2.1.2`);var le=globalThis,ue=e=>e,de=le.trustedTypes,fe=de?de.createPolicy(`lit-html`,{createHTML:e=>e}):void 0,pe=`$lit$`,g=`lit$${Math.random().toFixed(9).slice(2)}$`,me=`?`+g,he=`<${me}>`,_=document,v=()=>_.createComment(``),y=e=>e===null||typeof e!=`object`&&typeof e!=`function`,ge=Array.isArray,_e=e=>ge(e)||typeof e?.[Symbol.iterator]==`function`,ve=`[ 	
\f\r]`,b=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,ye=/-->/g,be=/>/g,x=RegExp(`>|${ve}(?:([^\\s"'>=/]+)(${ve}*=${ve}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,`g`),xe=/'/g,Se=/"/g,Ce=/^(?:script|style|textarea|title)$/i,S=(e=>(t,...n)=>({_$litType$:e,strings:t,values:n}))(1),C=Symbol.for(`lit-noChange`),w=Symbol.for(`lit-nothing`),we=new WeakMap,T=_.createTreeWalker(_,129);function Te(e,t){if(!ge(e)||!e.hasOwnProperty(`raw`))throw Error(`invalid template strings array`);return fe===void 0?t:fe.createHTML(t)}var Ee=(e,t)=>{let n=e.length-1,r=[],i,a=t===2?`<svg>`:t===3?`<math>`:``,o=b;for(let t=0;t<n;t++){let n=e[t],s,c,l=-1,u=0;for(;u<n.length&&(o.lastIndex=u,c=o.exec(n),c!==null);)u=o.lastIndex,o===b?c[1]===`!--`?o=ye:c[1]===void 0?c[2]===void 0?c[3]!==void 0&&(o=x):(Ce.test(c[2])&&(i=RegExp(`</`+c[2],`g`)),o=x):o=be:o===x?c[0]===`>`?(o=i??b,l=-1):c[1]===void 0?l=-2:(l=o.lastIndex-c[2].length,s=c[1],o=c[3]===void 0?x:c[3]===`"`?Se:xe):o===Se||o===xe?o=x:o===ye||o===be?o=b:(o=x,i=void 0);let d=o===x&&e[t+1].startsWith(`/>`)?` `:``;a+=o===b?n+he:l>=0?(r.push(s),n.slice(0,l)+pe+n.slice(l)+g+d):n+g+(l===-2?t:d)}return[Te(e,a+(e[n]||`<?>`)+(t===2?`</svg>`:t===3?`</math>`:``)),r]},De=class e{constructor({strings:t,_$litType$:n},r){let i;this.parts=[];let a=0,o=0,s=t.length-1,c=this.parts,[l,u]=Ee(t,n);if(this.el=e.createElement(l,r),T.currentNode=this.el.content,n===2||n===3){let e=this.el.content.firstChild;e.replaceWith(...e.childNodes)}for(;(i=T.nextNode())!==null&&c.length<s;){if(i.nodeType===1){if(i.hasAttributes())for(let e of i.getAttributeNames())if(e.endsWith(pe)){let t=u[o++],n=i.getAttribute(e).split(g),r=/([.?@])?(.*)/.exec(t);c.push({type:1,index:a,name:r[2],strings:n,ctor:r[1]===`.`?Ae:r[1]===`?`?je:r[1]===`@`?Me:D}),i.removeAttribute(e)}else e.startsWith(g)&&(c.push({type:6,index:a}),i.removeAttribute(e));if(Ce.test(i.tagName)){let e=i.textContent.split(g),t=e.length-1;if(t>0){i.textContent=de?de.emptyScript:``;for(let n=0;n<t;n++)i.append(e[n],v()),T.nextNode(),c.push({type:2,index:++a});i.append(e[t],v())}}}else if(i.nodeType===8)if(i.data===me)c.push({type:2,index:a});else{let e=-1;for(;(e=i.data.indexOf(g,e+1))!==-1;)c.push({type:7,index:a}),e+=g.length-1}a++}}static createElement(e,t){let n=_.createElement(`template`);return n.innerHTML=e,n}};function E(e,t,n=e,r){if(t===C)return t;let i=r===void 0?n._$Cl:n._$Co?.[r],a=y(t)?void 0:t._$litDirective$;return i?.constructor!==a&&(i?._$AO?.(!1),a===void 0?i=void 0:(i=new a(e),i._$AT(e,n,r)),r===void 0?n._$Cl=i:(n._$Co??=[])[r]=i),i!==void 0&&(t=E(e,i._$AS(e,t.values),i,r)),t}var Oe=class{constructor(e,t){this._$AV=[],this._$AN=void 0,this._$AD=e,this._$AM=t}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(e){let{el:{content:t},parts:n}=this._$AD,r=(e?.creationScope??_).importNode(t,!0);T.currentNode=r;let i=T.nextNode(),a=0,o=0,s=n[0];for(;s!==void 0;){if(a===s.index){let t;s.type===2?t=new ke(i,i.nextSibling,this,e):s.type===1?t=new s.ctor(i,s.name,s.strings,this,e):s.type===6&&(t=new Ne(i,this,e)),this._$AV.push(t),s=n[++o]}a!==s?.index&&(i=T.nextNode(),a++)}return T.currentNode=_,r}p(e){let t=0;for(let n of this._$AV)n!==void 0&&(n.strings===void 0?n._$AI(e[t]):(n._$AI(e,n,t),t+=n.strings.length-2)),t++}},ke=class e{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(e,t,n,r){this.type=2,this._$AH=w,this._$AN=void 0,this._$AA=e,this._$AB=t,this._$AM=n,this.options=r,this._$Cv=r?.isConnected??!0}get parentNode(){let e=this._$AA.parentNode,t=this._$AM;return t!==void 0&&e?.nodeType===11&&(e=t.parentNode),e}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(e,t=this){e=E(this,e,t),y(e)?e===w||e==null||e===``?(this._$AH!==w&&this._$AR(),this._$AH=w):e!==this._$AH&&e!==C&&this._(e):e._$litType$===void 0?e.nodeType===void 0?_e(e)?this.k(e):this._(e):this.T(e):this.$(e)}O(e){return this._$AA.parentNode.insertBefore(e,this._$AB)}T(e){this._$AH!==e&&(this._$AR(),this._$AH=this.O(e))}_(e){this._$AH!==w&&y(this._$AH)?this._$AA.nextSibling.data=e:this.T(_.createTextNode(e)),this._$AH=e}$(e){let{values:t,_$litType$:n}=e,r=typeof n==`number`?this._$AC(e):(n.el===void 0&&(n.el=De.createElement(Te(n.h,n.h[0]),this.options)),n);if(this._$AH?._$AD===r)this._$AH.p(t);else{let e=new Oe(r,this),n=e.u(this.options);e.p(t),this.T(n),this._$AH=e}}_$AC(e){let t=we.get(e.strings);return t===void 0&&we.set(e.strings,t=new De(e)),t}k(t){ge(this._$AH)||(this._$AH=[],this._$AR());let n=this._$AH,r,i=0;for(let a of t)i===n.length?n.push(r=new e(this.O(v()),this.O(v()),this,this.options)):r=n[i],r._$AI(a),i++;i<n.length&&(this._$AR(r&&r._$AB.nextSibling,i),n.length=i)}_$AR(e=this._$AA.nextSibling,t){for(this._$AP?.(!1,!0,t);e!==this._$AB;){let t=ue(e).nextSibling;ue(e).remove(),e=t}}setConnected(e){this._$AM===void 0&&(this._$Cv=e,this._$AP?.(e))}},D=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(e,t,n,r,i){this.type=1,this._$AH=w,this._$AN=void 0,this.element=e,this.name=t,this._$AM=r,this.options=i,n.length>2||n[0]!==``||n[1]!==``?(this._$AH=Array(n.length-1).fill(new String),this.strings=n):this._$AH=w}_$AI(e,t=this,n,r){let i=this.strings,a=!1;if(i===void 0)e=E(this,e,t,0),a=!y(e)||e!==this._$AH&&e!==C,a&&(this._$AH=e);else{let r=e,o,s;for(e=i[0],o=0;o<i.length-1;o++)s=E(this,r[n+o],t,o),s===C&&(s=this._$AH[o]),a||=!y(s)||s!==this._$AH[o],s===w?e=w:e!==w&&(e+=(s??``)+i[o+1]),this._$AH[o]=s}a&&!r&&this.j(e)}j(e){e===w?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,e??``)}},Ae=class extends D{constructor(){super(...arguments),this.type=3}j(e){this.element[this.name]=e===w?void 0:e}},je=class extends D{constructor(){super(...arguments),this.type=4}j(e){this.element.toggleAttribute(this.name,!!e&&e!==w)}},Me=class extends D{constructor(e,t,n,r,i){super(e,t,n,r,i),this.type=5}_$AI(e,t=this){if((e=E(this,e,t,0)??w)===C)return;let n=this._$AH,r=e===w&&n!==w||e.capture!==n.capture||e.once!==n.once||e.passive!==n.passive,i=e!==w&&(n===w||r);r&&this.element.removeEventListener(this.name,this,n),i&&this.element.addEventListener(this.name,this,e),this._$AH=e}handleEvent(e){typeof this._$AH==`function`?this._$AH.call(this.options?.host??this.element,e):this._$AH.handleEvent(e)}},Ne=class{constructor(e,t,n){this.element=e,this.type=6,this._$AN=void 0,this._$AM=t,this.options=n}get _$AU(){return this._$AM._$AU}_$AI(e){E(this,e)}},Pe=le.litHtmlPolyfillSupport;Pe?.(De,ke),(le.litHtmlVersions??=[]).push(`3.3.3`);var Fe=(e,t,n)=>{let r=n?.renderBefore??t,i=r._$litPart$;if(i===void 0){let e=n?.renderBefore??null;r._$litPart$=i=new ke(t.insertBefore(v(),e),e,void 0,n??{})}return i._$AI(e),i},Ie=globalThis,O=class extends h{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let e=super.createRenderRoot();return this.renderOptions.renderBefore??=e.firstChild,e}update(e){let t=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(e),this._$Do=Fe(t,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return C}};O._$litElement$=!0,O.finalized=!0,Ie.litElementHydrateSupport?.({LitElement:O});var Le=Ie.litElementPolyfillSupport;Le?.({LitElement:O}),(Ie.litElementVersions??=[]).push(`4.2.2`);var k=e=>(t,n)=>{n===void 0?customElements.define(e,t):n.addInitializer(()=>{customElements.define(e,t)})},Re={attribute:!0,type:String,converter:m,reflect:!1,hasChanged:se},ze=(e=Re,t,n)=>{let{kind:r,metadata:i}=n,a=globalThis.litPropertyMetadata.get(i);if(a===void 0&&globalThis.litPropertyMetadata.set(i,a=new Map),r===`setter`&&((e=Object.create(e)).wrapped=!0),a.set(n.name,e),r===`accessor`){let{name:r}=n;return{set(n){let i=t.get.call(this);t.set.call(this,n),this.requestUpdate(r,i,e,!0,n)},init(t){return t!==void 0&&this.C(r,void 0,e,t),t}}}if(r===`setter`){let{name:r}=n;return function(n){let i=this[r];t.call(this,n),this.requestUpdate(r,i,e,!0,n)}}throw Error(`Unsupported decorator location: `+r)};function Be(e){return(t,n)=>typeof n==`object`?ze(e,t,n):((e,t,n)=>{let r=t.hasOwnProperty(n);return t.constructor.createProperty(n,e),r?Object.getOwnPropertyDescriptor(t,n):void 0})(e,t,n)}function A(e){return Be({...e,state:!0,attribute:!1})}var j=class e{static{this.instance=null}constructor(){this.socket=null,this.token=``,this.gatewayHost=``,this.gatewayPort=8e3,this.pendingRequests=new Map,this.statusListeners=new Set,this.eventListeners=new Set,this.reconnectTimeout=null,this.reconnectAttempts=0,this.isConnecting=!1,this.extractToken(),this.connect()}static getInstance(){return e.instance||=new e,e.instance}extractToken(){let e=window.location.hash;if(e.startsWith(`#token=`)){this.token=e.replace(`#token=`,``).trim(),sessionStorage.setItem(`komorebi_gateway_token`,this.token),window.history.replaceState(null,``,window.location.pathname+window.location.search);return}let t=sessionStorage.getItem(`komorebi_gateway_token`);t||(t=window.prompt(`Komorebi Gateway Access Token required:`),t&&(t=t.trim(),sessionStorage.setItem(`komorebi_gateway_token`,t))),this.token=t||``}getToken(){return this.token}getGatewayUrl(){return`${window.location.protocol===`https:`?`https:`:`http:`}//${this.gatewayHost}:${this.gatewayPort}`}setToken(e){this.token=e,sessionStorage.setItem(`komorebi_gateway_token`,e),this.reconnectAttempts=0,this.connect()}async connect(){this.socket&&=(this.socket.close(),null),this.reconnectTimeout&&=(clearTimeout(this.reconnectTimeout),null);let e={};try{let t=await fetch(`/komorebi.config.json`);if(t.ok){let n=await t.text();n&&n.trim().startsWith(`{`)&&(e=JSON.parse(n))}}catch{console.warn(`[WsClient] Failed to load /komorebi.config.json, using local hostname fallback.`)}this.token=e.gateway?.authToken||this.token;let t=window.location.port===`5173`||window.location.port===`3000`;this.gatewayHost=t?e.gateway?.host||`127.0.0.1`:window.location.hostname,this.gatewayPort=t?e.gateway?.port||2389:parseInt(window.location.port||`8000`,10);let n=this.getGatewayUrl().replace(/^http/,`ws`)+`?token=${encodeURIComponent(this.token)}`;console.log(`[WsClient] Connecting to: ${n.replace(this.token,`[REDACTED]`)}`);try{this.socket=new WebSocket(n),this.setupSocketHandlers()}catch(e){console.error(`[WsClient] Connection error:`,e),this.handleDisconnect()}}setupSocketHandlers(){this.socket&&(this.socket.onopen=()=>{console.log(`[WsClient] Connected to Gateway.`),this.isConnecting=!1,this.reconnectAttempts=0,this.notifyStatus(`connected`),this.send(`busSubscribe`,{topic:`*`}).catch(()=>{})},this.socket.onmessage=e=>{try{let t=JSON.parse(e.data);if(t.type===`res`){let e=this.pendingRequests.get(t.id);e&&(this.pendingRequests.delete(t.id),t.ok?e.resolve(t.payload):e.reject(Error(t.error||`RPC Error`)))}else t.type===`evt`&&this.notifyEvent(t.event,t.data)}catch(e){console.error(`[WsClient] Message parsing failed:`,e)}},this.socket.onclose=()=>{console.warn(`[WsClient] Connection closed.`),this.handleDisconnect()},this.socket.onerror=e=>{console.error(`[WsClient] Socket error occurred:`,e)})}handleDisconnect(){this.socket=null,this.isConnecting=!1,this.notifyStatus(`disconnected`);for(let[e,t]of this.pendingRequests.entries())t.reject(Error(`WebSocket disconnected`)),this.pendingRequests.delete(e);this.reconnectAttempts++;let e=Math.min(1e3*1.5**this.reconnectAttempts,15e3);console.log(`[WsClient] Reconnecting in ${Math.round(e)}ms (Attempt ${this.reconnectAttempts})`),this.reconnectTimeout=setTimeout(()=>{this.connect()},e)}send(e,t={}){let n=crypto.randomUUID();return new Promise((r,i)=>{if(!this.socket||this.socket.readyState!==WebSocket.OPEN)return i(Error(`WebSocket is not connected`));this.pendingRequests.set(n,{resolve:r,reject:i}),this.socket.send(JSON.stringify({type:`req`,id:n,method:e,params:t}))})}addStatusListener(e){this.statusListeners.add(e),this.socket&&this.socket.readyState===WebSocket.OPEN?e(`connected`):this.isConnecting?e(`connecting`):e(`disconnected`)}removeStatusListener(e){this.statusListeners.delete(e)}addEventListener(e){this.eventListeners.add(e)}removeEventListener(e){this.eventListeners.delete(e)}notifyStatus(e){for(let t of this.statusListeners)try{t(e)}catch(e){console.error(e)}}notifyEvent(e,t){for(let n of this.eventListeners)try{n(e,t)}catch(e){console.error(e)}}},M=class extends O{constructor(...e){super(...e),this.activeInstances=[],this.config=null,this.agents=[],this.teams=[],this.agentStats={},this.systemStats={totalSessions:0,uptime:`0d 0h 0m`,ramTotal:0},this.intelligenceData={},this.curatingAgentId=null,this.curateMsg=``,this.liveCognitiveFeed=[],this.wsClient=j.getInstance(),this.statsInterval=null,this.startTime=Date.now()-36e5}static{this.styles=s`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      font-family: var(--font-display, "Inter", sans-serif);
      color: var(--text-primary);
    }

    .title {
      font-size: 1.75rem;
      font-weight: 800;
      background: linear-gradient(135deg, #a78bfa 0%, #ec4899 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    /* Grid Layouts */
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
    }

    .card {
      background: rgba(30, 30, 40, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 1.25rem;
      backdrop-filter: blur(8px);
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }

    .card-info { display: flex; flex-direction: column; gap: 0.25rem; }
    .card-label { font-size: 0.75rem; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
    .card-value { font-size: 1.8rem; font-weight: 700; color: #fff; }
    .card-icon {
      font-size: 2.2rem; background: rgba(255,255,255,0.02); width: 50px; height: 50px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 50%; border: 1px solid rgba(255,255,255,0.05);
    }

    .panel {
      background: rgba(30, 30, 40, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 1.5rem;
      backdrop-filter: blur(8px);
    }

    .panel-header {
      font-size: 1.1rem;
      font-weight: 700;
      color: #fff;
      margin-bottom: 1.25rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      padding-bottom: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .stats-layout {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 1.5rem;
    }

    @media (max-width: 768px) { .stats-layout { grid-template-columns: 1fr; } }

    .mood-stat-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .mood-stat-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.5rem 0.75rem; border-radius: 8px;
      background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
    }
    .mood-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 0.5rem; }

    .badge { display: inline-flex; align-items: center; padding: 0.25rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .badge-focused { background: rgba(16,185,129,0.15); color: #34d399; }
    .badge-busy { background: rgba(245,158,11,0.15); color: #fbbf24; }
    .badge-idle { background: rgba(59,130,246,0.15); color: #60a5fa; }
    .badge-alert { background: rgba(239,68,68,0.15); color: #f87171; }

    /* Intelligence Panel */
    .intel-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }

    .intel-card {
      background: rgba(10, 10, 20, 0.5);
      border: 1px solid rgba(167, 139, 250, 0.12);
      border-radius: 12px;
      padding: 1rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      transition: border-color 0.3s, box-shadow 0.3s;
    }

    .intel-card:hover {
      border-color: rgba(167, 139, 250, 0.4);
      box-shadow: 0 0 20px rgba(167, 139, 250, 0.07);
    }

    .intel-card-name { font-weight: 700; font-size: 1rem; color: #e5e7eb; }

    .intel-bar-row { display: flex; align-items: center; gap: 0.75rem; }
    .intel-bar-label { font-size: 0.72rem; color: #9ca3af; width: 90px; flex-shrink: 0; text-transform: uppercase; letter-spacing: 0.4px; }
    .intel-bar-track { flex: 1; height: 6px; background: rgba(255,255,255,0.06); border-radius: 99px; overflow: hidden; }
    .intel-bar-fill { height: 100%; border-radius: 99px; transition: width 0.8s cubic-bezier(0.4,0,0.2,1); }
    .intel-bar-val { font-size: 0.75rem; font-weight: 700; color: #e5e7eb; width: 38px; text-align: right; flex-shrink: 0; }

    .intel-meta { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .intel-chip {
      font-size: 0.7rem; padding: 0.2rem 0.45rem; border-radius: 4px;
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); color: #9ca3af;
    }

    .iq-score { font-size: 1.5rem; font-weight: 800; }

    .curate-btn {
      background: none; border: 1px solid rgba(167,139,250,0.3); color: #a78bfa;
      padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 0.75rem; cursor: pointer; transition: all 0.2s;
      align-self: flex-start;
    }
    .curate-btn:hover { background: rgba(167,139,250,0.1); }
    .curate-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .curate-msg { font-size: 0.78rem; color: #34d399; }
  `}connectedCallback(){super.connectedCallback(),this.wsClient.addStatusListener(e=>{e===`connected`&&(this.loadConfig(),this.startPolling())})}disconnectedCallback(){super.disconnectedCallback(),this.statsInterval&&clearInterval(this.statsInterval)}startPolling(){this.statsInterval&&clearInterval(this.statsInterval),this.pollData(),this.statsInterval=setInterval(()=>this.pollData(),5e3)}async pollData(){try{this.activeInstances=await this.wsClient.send(`getAgentsTelemetry`).catch(()=>[]),this.systemStats.ramTotal=this.activeInstances.reduce((e,t)=>e+t.ramUsageMb,0);let e=await this.wsClient.send(`listSessions`).catch(()=>[]);this.systemStats.totalSessions=e.length;let t={};for(let e of this.agents)try{t[e.id]=await this.wsClient.send(`getAgentStats`,{agentId:e.id})}catch{}this.agentStats=t;let n=await this.wsClient.send(`getFleetIntelligence`).catch(()=>({agents:{}}));this.intelligenceData=n.agents||{};let r=[];for(let e of this.agents)try{let t=await this.wsClient.send(`getAgentAdvancedStats`,{agentId:e.id}),n=t.promptDrift||[],i=t.learningLog||[];for(let t of n)r.push({agentName:e.name||e.id,type:`drift`,timestamp:t.timestamp,detail:t.delta});for(let t of i)r.push({agentName:e.name||e.id,type:`learning`,timestamp:t.timestamp,detail:`Completed session with ${t.toolCallsCount} tool calls (confidence: ${(t.confidence*100).toFixed(0)}%)`,success:t.success})}catch{}this.liveCognitiveFeed=r.sort((e,t)=>t.timestamp-e.timestamp).slice(0,5),this.calculateUptime()}catch{}}async loadConfig(){try{let e=await this.wsClient.send(`getSystemConfig`);this.config=e.config,this.agents=this.config.agents||[],this.teams=this.config.teams||[],this.config.gatewayStartTime&&(this.startTime=this.config.gatewayStartTime)}catch{}}async triggerCuration(e){this.curatingAgentId=e,this.curateMsg=``;try{let t=await this.wsClient.send(`curateAgentSkills`,{agentId:e});this.curateMsg=`✓ ${t.message||`Curation triggered`}`,setTimeout(()=>this.pollData(),2500)}catch(e){this.curateMsg=`✗ ${e.message||`Curation failed`}`}finally{this.curatingAgentId=null,setTimeout(()=>{this.curateMsg=``},5e3)}}calculateUptime(){let e=Date.now()-this.startTime,t=Math.floor(e/(24*3600*1e3)),n=Math.floor(e%(24*3600*1e3)/(3600*1e3)),r=Math.floor(e%(3600*1e3)/(60*1e3));this.systemStats.uptime=`${t}d ${n}h ${r}m`}getMoodCount(e){return Object.values(this.agentStats).filter(t=>t.mood===e&&t.status===`running`).length}computeIQ(e){if(!e)return 0;let t=(e.skillSuccessRate??0)*50,n=Math.min(e.totalTurns??0,500)/500*20,r=Math.min(e.learnedSkillCount??0,20)/20*15,i=Math.min(e.memorySizeKb??0,64)/64*15;return Math.min(100,Math.round(t+n+r+i))}render(){return S`
      <div class="title">Gateway Fleet Overview</div>

      <!-- Quick Metrics Grid -->
      <div class="grid">
        <div class="card">
          <div class="card-info">
            <div class="card-label">Active Agents</div>
            <div class="card-value">${this.activeInstances.filter(e=>e.status===`running`).length}</div>
          </div>
          <div class="card-icon" style="color: #a78bfa">🤖</div>
        </div>

        <div class="card">
          <div class="card-info">
            <div class="card-label">Active Sessions</div>
            <div class="card-value">${this.systemStats.totalSessions}</div>
          </div>
          <div class="card-icon" style="color: #ec4899">💬</div>
        </div>

        <div class="card">
          <div class="card-info">
            <div class="card-label">Fleet RAM RSS</div>
            <div class="card-value">${this.systemStats.ramTotal} MB</div>
          </div>
          <div class="card-icon" style="color: #10b981">🧠</div>
        </div>

        <div class="card">
          <div class="card-info">
            <div class="card-label">Gateway Uptime</div>
            <div class="card-value" style="font-size: 1.4rem">${this.systemStats.uptime}</div>
          </div>
          <div class="card-icon" style="color: #fbbf24">⚡</div>
        </div>
      </div>

      <div class="stats-layout">
        <!-- Topology / Agent list -->
        <div class="panel">
          <div class="panel-header">Fleet Members & Topology</div>
          <div style="display: flex; flex-direction: column; gap: 0.75rem">
            ${this.agents.map(e=>{let t=this.agentStats[e.id]||{status:`offline`,mood:`offline`},n=t.status===`running`;return S`
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); padding: 0.75rem 1rem; border-radius: 10px; border: 1px solid rgba(255,255,255,0.04)">
                  <div>
                    <div style="font-weight: 700; color: #fff">${e.name}</div>
                    <div style="font-size: 0.75rem; color: #9ca3af">
                      ${e.id} • ${e.model?.name} • Runtime: ${e.model?.agentRuntime?.id||e.model?.agentRuntimeId||`komorebi`}
                    </div>
                  </div>
                  <div>
                    <span class="badge badge-${n?t.mood||`focused`:`offline`}">
                      ${n?(t.mood||`focused`).toUpperCase():`OFFLINE`}
                    </span>
                  </div>
                </div>
              `})}
          </div>
          
          <!-- Collaboration Teams -->
          <div class="panel-header" style="margin-top: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.75rem;">Collaboration Teams</div>
          <div style="display: flex; flex-direction: column; gap: 0.75rem">
            ${this.teams.length===0?S`
              <div style="color: var(--text-muted); font-size: 0.85rem; font-style: italic; padding: 0.5rem">
                No teams configured yet. Create one in the Teams Registry.
              </div>
            `:this.teams.map(e=>S`
              <div style="background: rgba(255,255,255,0.02); padding: 0.75rem 1rem; border-radius: 10px; border: 1px solid rgba(255,255,255,0.04)">
                <div style="display: flex; justify-content: space-between; align-items: center">
                  <div>
                    <div style="font-weight: 700; color: #fff">${e.name}</div>
                    <div style="font-size: 0.75rem; color: #9ca3af">
                      ID: ${e.id} • Leader: <code>${e.leaderAgentId||`None`}</code>
                    </div>
                  </div>
                  <span class="badge badge-focused">${e.memberAgentIds.length} Members</span>
                </div>
              </div>
            `)}
          </div>
        </div>

        <!-- Fleet Mood Analytics -->
        <div style="display: flex; flex-direction: column; gap: 1rem">
          <div class="panel">
            <div class="panel-header">Fleet Mood Distribution</div>
            <div class="mood-stat-list">
              <div class="mood-stat-item">
                <span><span class="mood-dot" style="background-color: #10b981"></span>Focused</span>
                <span class="badge badge-focused">${this.getMoodCount(`focused`)}</span>
              </div>
              <div class="mood-stat-item">
                <span><span class="mood-dot" style="background-color: #f59e0b"></span>Busy</span>
                <span class="badge badge-busy">${this.getMoodCount(`busy`)}</span>
              </div>
              <div class="mood-stat-item">
                <span><span class="mood-dot" style="background-color: #3b82f6"></span>Idle</span>
                <span class="badge badge-idle">${this.getMoodCount(`idle`)}</span>
              </div>
              <div class="mood-stat-item">
                <span><span class="mood-dot" style="background-color: #ef4444"></span>Alert</span>
                <span class="badge badge-alert">${this.getMoodCount(`alert`)}</span>
              </div>
            </div>
          </div>

          <!-- Live Cognitive Activity Feed -->
          <div class="panel">
            <div class="panel-header">🧠 Live Cognitive Feed</div>
            ${this.liveCognitiveFeed.length===0?S`
              <div style="color: #9ca3af; font-size: 0.82rem; font-style: italic; padding: 0.25rem">
                No learning events or strategy adjustments recorded yet.
              </div>
            `:S`
              <div style="display: flex; flex-direction: column; gap: 0.6rem; max-height: 380px; overflow-y: auto; padding-right: 0.25rem">
                ${this.liveCognitiveFeed.map(e=>{let t=e.type===`drift`,n=t?`rgba(167, 139, 250, 0.12)`:e.success?`rgba(16, 185, 129, 0.12)`:`rgba(239, 68, 68, 0.12)`,r=t?`#a78bfa`:e.success?`#34d399`:`#f87171`,i=t?`SELF-CORRECT`:e.success?`SUCCESS`:`FAILURE`;return S`
                    <div style="background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); padding: 0.6rem 0.8rem; border-radius: 8px; display: flex; flex-direction: column; gap: 0.25rem">
                      <div style="display: flex; justify-content: space-between; align-items: center">
                        <span style="font-weight: 700; font-size: 0.8rem; color: #fff">${e.agentName}</span>
                        <span class="badge" style="background: ${n}; color: ${r}; font-size: 0.6rem; padding: 0.1rem 0.35rem; border-radius: 4px">
                          ${i}
                        </span>
                      </div>
                      <div style="font-size: 0.76rem; color: #d1d5db; font-family: monospace; word-break: break-word">
                        ${e.detail}
                      </div>
                      <div style="font-size: 0.65rem; color: #4b5563; text-align: right">
                        ${new Date(e.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  `})}
              </div>
            `}
          </div>
        </div>
      </div>

      <!-- ===== AGENT INTELLIGENCE PANEL ===== -->
      <div class="panel">
        <div class="panel-header">
          <span>🧠 Agent Intelligence Scores</span>
          ${this.curateMsg?S`<span class="curate-msg">${this.curateMsg}</span>`:``}
        </div>

        ${this.agents.length===0?S`
          <div style="color: #9ca3af; font-style: italic; font-size: 0.85rem">No agents configured.</div>
        `:S`
          <div class="intel-grid">
            ${this.agents.map(e=>{let t=this.intelligenceData[e.id]||{},n=this.computeIQ(t),r=t.skillSuccessRate??0,i=t.learnedSkillCount??0,a=t.totalTurns??0,o=t.memorySizeKb??0,s=t.lastCuration?new Date(t.lastCuration).toLocaleDateString():`Never`,c=n>=75?`#34d399`:n>=45?`#fbbf24`:`#f87171`,l=r>=.75?`#34d399`:r>=.4?`#fbbf24`:`#f87171`,u=Math.min(i/20,1);return S`
                <div class="intel-card">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start">
                    <div>
                      <div class="intel-card-name">${e.name}</div>
                      <div style="font-size: 0.72rem; color: #6b7280; font-family: monospace">${e.id}</div>
                    </div>
                    <div style="text-align: right">
                      <div class="iq-score" style="background: linear-gradient(135deg, ${c}, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent">${n}</div>
                      <div style="font-size: 0.65rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px">IQ Score</div>
                    </div>
                  </div>

                  <div class="intel-bar-row">
                    <span class="intel-bar-label">Success Rate</span>
                    <div class="intel-bar-track">
                      <div class="intel-bar-fill" style="width: ${(r*100).toFixed(0)}%; background: ${l}"></div>
                    </div>
                    <span class="intel-bar-val" style="color: ${l}">${(r*100).toFixed(0)}%</span>
                  </div>

                  <div class="intel-bar-row">
                    <span class="intel-bar-label">Learned Skills</span>
                    <div class="intel-bar-track">
                      <div class="intel-bar-fill" style="width: ${(u*100).toFixed(0)}%; background: #a78bfa"></div>
                    </div>
                    <span class="intel-bar-val">${i}</span>
                  </div>

                  <div class="intel-meta">
                    <span class="intel-chip">💬 ${a} turns</span>
                    <span class="intel-chip">💾 ${o} KB mem</span>
                    <span class="intel-chip">🕒 ${s}</span>
                  </div>

                  <button
                    class="curate-btn"
                    @click=${()=>this.triggerCuration(e.id)}
                    ?disabled=${this.curatingAgentId!==null}
                  >
                    ${this.curatingAgentId===e.id?`⏳ Curating...`:`⚡ Curate Skills Now`}
                  </button>
                </div>
              `})}
          </div>
        `}
      </div>
    `}};e([A()],M.prototype,`activeInstances`,void 0),e([A()],M.prototype,`config`,void 0),e([A()],M.prototype,`agents`,void 0),e([A()],M.prototype,`teams`,void 0),e([A()],M.prototype,`agentStats`,void 0),e([A()],M.prototype,`systemStats`,void 0),e([A()],M.prototype,`intelligenceData`,void 0),e([A()],M.prototype,`curatingAgentId`,void 0),e([A()],M.prototype,`curateMsg`,void 0),e([A()],M.prototype,`liveCognitiveFeed`,void 0),M=e([k(`overview-page`)],M);var N=class extends O{constructor(...e){super(...e),this.systemUptime=`0m`,this.agentsHealth={},this.config=null,this.loading=!0,this.wsClient=j.getInstance(),this.pollInterval=null}static{this.styles=s`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      font-family: var(--font-display, "Inter", sans-serif);
      color: var(--text-primary);
    }

    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .title {
      font-size: 1.75rem;
      font-weight: 800;
      background: linear-gradient(135deg, #a78bfa 0%, #ec4899 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .uptime {
      font-size: 0.85rem;
      color: var(--text-muted);
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border-color);
      padding: 0.3rem 0.6rem;
      border-radius: 6px;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1.5rem;
    }

    .card {
      background: rgba(30, 30, 40, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 1.5rem;
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      padding-bottom: 0.75rem;
    }

    .agent-name {
      font-size: 1.2rem;
      font-weight: 700;
      color: #fff;
    }

    .state-badge {
      font-size: 0.75rem;
      font-weight: bold;
      text-transform: uppercase;
      padding: 0.25rem 0.5rem;
      border-radius: 6px;
      letter-spacing: 0.5px;
    }

    .state-healthy {
      background: rgba(46, 204, 113, 0.15);
      color: var(--status-green, #2ecc71);
      border: 1px solid rgba(46, 204, 113, 0.3);
    }

    .state-degraded {
      background: rgba(241, 196, 15, 0.15);
      color: #f1c40f;
      border: 1px solid rgba(241, 196, 15, 0.3);
    }

    .state-paused {
      background: rgba(52, 152, 219, 0.15);
      color: var(--accent-secondary, #3498db);
      border: 1px solid rgba(52, 152, 219, 0.3);
    }

    .state-offline {
      background: rgba(231, 76, 60, 0.15);
      color: #e74c3c;
      border: 1px solid rgba(231, 76, 60, 0.3);
    }

    .metric-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.9rem;
    }

    .metric-label {
      color: var(--text-muted);
    }

    .metric-value {
      font-weight: 600;
      color: #fff;
    }

    .cost-progress-bar {
      width: 100%;
      height: 6px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 3px;
      overflow: hidden;
      margin-top: 0.25rem;
    }

    .cost-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .cost-progress-fill.over {
      background: #e74c3c;
    }

    .error-rate-dots {
      display: flex;
      gap: 3px;
    }

    .error-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
    }

    .error-dot.success {
      background: #2ecc71;
    }

    .error-dot.failure {
      background: #e74c3c;
    }

    .reason-box {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 0.5rem;
      font-size: 0.8rem;
      color: var(--text-muted);
      font-style: italic;
      word-break: break-word;
    }

    .btn {
      background: var(--accent-primary);
      border: none;
      color: #white;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: bold;
      cursor: pointer;
      transition: background 0.3s;
      width: 100%;
      text-align: center;
    }

    .btn:hover {
      background: var(--accent-secondary);
    }

    .btn-disabled {
      background: rgba(255, 255, 255, 0.05) !important;
      color: var(--text-muted) !important;
      cursor: not-allowed;
    }

    .loading-state {
      text-align: center;
      padding: 3rem;
      color: var(--text-muted);
      font-style: italic;
    }
  `}connectedCallback(){super.connectedCallback(),this.loadConfig(),this.fetchHealth(),this.pollInterval=setInterval(()=>this.fetchHealth(),5e3)}disconnectedCallback(){super.disconnectedCallback(),this.pollInterval&&clearInterval(this.pollInterval)}async loadConfig(){try{let e=await this.wsClient.send(`getSystemConfig`);this.config=e.config}catch(e){console.error(`[HealthPage] Failed to load config:`,e)}}async fetchHealth(){try{let e=await this.wsClient.send(`getSystemHealth`);this.systemUptime=this.formatUptime(e.systemUptimeMs),this.agentsHealth=e.agents||{}}catch(e){console.error(`[HealthPage] Failed to fetch health details:`,e)}finally{this.loading=!1}}async handleResume(e){try{(await this.wsClient.send(`resumeAgent`,{agentId:e})).success&&this.fetchHealth()}catch(e){console.error(`[HealthPage] Failed to resume agent:`,e)}}formatUptime(e){let t=Math.floor(e/1e3),n=Math.floor(t/86400),r=Math.floor(t%86400/3600),i=Math.floor(t%3600/60),a=[];return n>0&&a.push(`${n}d`),r>0&&a.push(`${r}h`),a.push(`${i}m`),a.join(` `)}render(){if(this.loading)return S`<div class="loading-state">Loading system health diagnostics...</div>`;let e=Object.keys(this.agentsHealth);return S`
      <div class="title-row">
        <div class="title">System Health & Watchdog Monitor</div>
        <div class="uptime">Uptime: ${this.systemUptime}</div>
      </div>

      <div class="grid">
        ${e.map(e=>{let t=this.agentsHealth[e],n=this.config?.agents?.find(t=>t.id===e),r=n?.dailyCostCapUSD||1,i=Math.min(100,t.dailyCostUSD/r*100),a=[...t.rollingToolErrors||[]];for(;a.length<20;)a.push(null);return S`
            <div class="card">
              <div class="card-header">
                <span class="agent-name">${n?.name||e}</span>
                <span class="state-badge state-${t.healthState}">
                  ${t.healthState}
                </span>
              </div>

              <div class="metric-row">
                <span class="metric-label">Daily Cost Tracking</span>
                <span class="metric-value">$${t.dailyCostUSD.toFixed(5)} / $${r.toFixed(2)}</span>
              </div>
              <div>
                <div class="cost-progress-bar">
                  <div class="cost-progress-fill ${i>=100?`over`:``}" style="width: ${i}%"></div>
                </div>
              </div>

              <div class="metric-row">
                <span class="metric-label">Telegram Bot Pairing</span>
                <span class="metric-value" style="color: ${t.botTokenValid?`#2ecc71`:`#e74c3c`}">
                  ${t.botTokenValid?`✓ Active`:`✗ Revoked`}
                </span>
              </div>

              <div class="metric-row">
                <span class="metric-label">Tool Call Failures</span>
                <span class="metric-value">${t.toolCallFailureCount} failed / ${t.toolCallSuccessCount+t.toolCallFailureCount} total</span>
              </div>

              <div>
                <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.3rem;">Rolling Tool Execution Errors (Last 20)</div>
                <div class="error-rate-dots">
                  ${a.map(e=>e===null?S`<div class="error-dot"></div>`:S`<div class="error-dot ${e?`failure`:`success`}"></div>`)}
                </div>
              </div>

              <div class="reason-box">
                Reason: ${t.lastStateChangeReason||`Healthy`}
              </div>

              <div>
                <button 
                  class="btn ${t.healthState!==`paused`&&t.healthState!==`degraded`?`btn-disabled`:``}" 
                  ?disabled=${t.healthState!==`paused`&&t.healthState!==`degraded`}
                  @click=${()=>this.handleResume(e)}
                >
                  Resume Agent Execution
                </button>
              </div>
            </div>
          `})}
      </div>
    `}};e([A()],N.prototype,`systemUptime`,void 0),e([A()],N.prototype,`agentsHealth`,void 0),e([A()],N.prototype,`config`,void 0),e([A()],N.prototype,`loading`,void 0),N=e([k(`health-page`)],N);var P=class extends O{constructor(...e){super(...e),this.knownFixes=[],this.incidents=[],this.pendingFixes=[],this.loading=!0,this.actionLoading=new Set,this.wsClient=j.getInstance(),this.pollInterval=null,this.handleBusMessage=(e,t)=>{e===`busMessage`&&t.topic===`self_healing_incident`&&this.fetchStatus()}}static{this.styles=s`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      font-family: var(--font-display, "Inter", sans-serif);
      color: var(--text-primary);
    }

    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .title {
      font-size: 1.75rem;
      font-weight: 800;
      background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .section-title {
      font-size: 1.2rem;
      font-weight: 700;
      color: #fff;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 1.5rem;
    }

    @media (max-width: 1024px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }

    .card {
      background: rgba(30, 30, 40, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 1.5rem;
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }

    .status-badge {
      font-size: 0.7rem;
      font-weight: bold;
      text-transform: uppercase;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      letter-spacing: 0.5px;
      display: inline-block;
    }

    .status-active {
      background: rgba(245, 158, 11, 0.15);
      color: #f59e0b;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }

    .status-resolved {
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }

    .status-failed {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .status-pending {
      background: rgba(59, 130, 246, 0.15);
      color: #3b82f6;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }

    .timeline {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .timeline-item {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.04);
      border-radius: 12px;
      padding: 1rem;
    }

    .timeline-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .comp-name {
      font-weight: 700;
      color: #fff;
      font-size: 0.95rem;
    }

    .error-sig {
      font-family: monospace;
      font-size: 0.8rem;
      background: rgba(0, 0, 0, 0.2);
      padding: 0.1rem 0.3rem;
      border-radius: 4px;
      color: #e2e8f0;
      word-break: break-all;
    }

    .time-stamp {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .outcome-box {
      font-size: 0.85rem;
      background: rgba(255, 255, 255, 0.03);
      padding: 0.5rem;
      border-radius: 6px;
      color: #e2e8f0;
      border-left: 3px solid var(--accent-primary);
    }

    .approval-card {
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 16px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      box-shadow: 0 4px 20px rgba(59, 130, 246, 0.1);
    }

    .approval-btn-group {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }

    .btn {
      padding: 0.4rem 0.8rem;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }

    .btn-approve {
      background: #10b981;
      color: #white;
    }

    .btn-approve:hover {
      background: #059669;
    }

    .btn-rollback {
      background: #ef4444;
      color: white;
    }

    .btn-rollback:hover {
      background: #dc2626;
    }

    .btn-loading {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .known-fixes-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .fix-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem;
      background: rgba(255, 255, 255, 0.02);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.04);
    }

    .fix-info {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .fix-cause {
      font-size: 0.85rem;
      font-weight: 600;
      color: #fff;
    }

    .fix-details {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .success-rate-pct {
      font-weight: 700;
      color: #10b981;
      font-size: 1rem;
    }

    .empty-state {
      padding: 2rem;
      text-align: center;
      color: var(--text-muted);
      font-style: italic;
      font-size: 0.9rem;
    }
  `}connectedCallback(){super.connectedCallback(),this.fetchStatus(),this.pollInterval=setInterval(()=>this.fetchStatus(),3e3),this.wsClient.addEventListener(this.handleBusMessage)}disconnectedCallback(){super.disconnectedCallback(),this.pollInterval&&clearInterval(this.pollInterval),this.wsClient.removeEventListener(this.handleBusMessage)}async fetchStatus(){try{let e=await this.wsClient.send(`getSelfHealingStatus`);this.knownFixes=e.knownFixes||[],this.incidents=e.incidents||[],this.pendingFixes=e.pendingFixes||[],this.loading=!1}catch(e){console.error(`[SelfHealingPage] Failed to fetch status:`,e)}}async approveFix(e,t){if(!this.actionLoading.has(e)){this.actionLoading.add(e),this.requestUpdate();try{(await this.wsClient.send(`applySelfHealingFix`,{fingerprint:e,fix:t})).success?alert(`Fix applied and verified successfully!`):alert(`Verification failed: regression tests failed, fix rolled back.`)}catch(e){alert(`Error applying fix: ${e.message}`)}finally{this.actionLoading.delete(e),this.fetchStatus()}}}async rollbackFix(e){if(!this.actionLoading.has(e)){this.actionLoading.add(e),this.requestUpdate();try{(await this.wsClient.send(`rollbackSelfHealingFix`,{fingerprint:e})).success?alert(`Successfully rolled back code changes.`):alert(`Failed to rollback fix.`)}catch(e){alert(`Error during rollback: ${e.message}`)}finally{this.actionLoading.delete(e),this.fetchStatus()}}}render(){return this.loading?S`<div class="empty-state">Loading self-healing center...</div>`:S`
      <div class="title-row">
        <h1 class="title">Self-Healing Center</h1>
      </div>

      ${this.pendingFixes.length>0?S`
            <div class="timeline">
              <h2 class="section-title">🚨 Pending Approvals (${this.pendingFixes.length})</h2>
              ${this.pendingFixes.map(e=>S`
                  <div class="approval-card">
                    <div class="timeline-header">
                      <div>
                        <span class="comp-name">${e.componentId}</span>
                        <div class="error-sig">${e.errorSignature}</div>
                      </div>
                      <span class="status-badge status-pending">Escalated</span>
                    </div>
                    <div class="outcome-box">
                      <strong>Root Cause:</strong> ${e.diagnosis?.rootCause||e.reason}<br />
                      <strong>Proposed Fix:</strong> ${e.diagnosis?.fixApplied||`None`}
                    </div>
                    <div class="approval-btn-group">
                      <button
                        class="btn btn-approve ${this.actionLoading.has(e.fingerprint)?`btn-loading`:``}"
                        @click=${()=>this.approveFix(e.fingerprint,e.diagnosis)}
                      >
                        Approve & Apply
                      </button>
                      <button
                        class="btn btn-rollback ${this.actionLoading.has(e.fingerprint)?`btn-loading`:``}"
                        @click=${()=>this.rollbackFix(e.fingerprint)}
                      >
                        Rollback
                      </button>
                    </div>
                  </div>
                `)}
            </div>
          `:``}

      <div class="grid">
        <div class="card">
          <h2 class="section-title">🛡️ Incident log timeline</h2>
          <div class="timeline">
            ${this.incidents.length===0?S`<div class="empty-state">No failures or recovery runs logged yet.</div>`:this.incidents.slice().reverse().map(e=>{let t=`status-active`;return e.status===`resolved`&&(t=`status-resolved`),e.status===`failed`&&(t=`status-failed`),e.status===`pending_approval`&&(t=`status-pending`),S`
                    <div class="timeline-item">
                      <div class="timeline-header">
                        <div>
                          <span class="comp-name">${e.componentId} (Tier ${e.tier})</span>
                          <div class="error-sig">${e.errorSignature}</div>
                        </div>
                        <span class="status-badge ${t}">${e.status}</span>
                      </div>
                      ${e.diagnosis?S`<div class="outcome-box"><strong>Diagnosis:</strong> ${e.diagnosis}</div>`:``}
                      ${e.outcome?S`<div class="outcome-box" style="border-left-color: #10b981;"><strong>Outcome:</strong> ${e.outcome}</div>`:``}
                      <div class="time-stamp">
                        ${new Date(e.timestamp).toLocaleString()} | fingerprint: ${e.fingerprint.substring(0,8)}
                        ${e.proposedFix&&e.proposedFix.fixType===`code`?S` | <a href="#" style="color: #ef4444; font-weight: bold; text-decoration: none;" @click=${t=>{t.preventDefault(),this.rollbackFix(e.fingerprint)}}>Rollback Code</a>`:``}
                      </div>
                    </div>
                  `})}
          </div>
        </div>

        <div class="card">
          <h2 class="section-title">🧠 Immune Memory registry</h2>
          <div class="known-fixes-list">
            ${this.knownFixes.length===0?S`<div class="empty-state">No vaccination records or immune fixes saved yet.</div>`:this.knownFixes.map(e=>S`
                    <div class="fix-item">
                      <div class="fix-info">
                        <span class="fix-cause">${e.rootCause}</span>
                        <span class="fix-details">
                          Type: ${e.fixType.toUpperCase()} | Runs: ${e.timesApplied}
                        </span>
                      </div>
                      <span class="success-rate-pct">${(e.successRate*100).toFixed(0)}%</span>
                    </div>
                  `)}
          </div>
        </div>
      </div>
    `}};e([A()],P.prototype,`knownFixes`,void 0),e([A()],P.prototype,`incidents`,void 0),e([A()],P.prototype,`pendingFixes`,void 0),e([A()],P.prototype,`loading`,void 0),e([A()],P.prototype,`actionLoading`,void 0),P=e([k(`self-healing-page`)],P);var F=class extends O{constructor(...e){super(...e),this.config=null,this.baseHash=``,this.botToken=``,this.mode=`polling`,this.webhookDomain=``,this.allowFrom=``,this.groupPolicy=`allowlist`,this.dmPolicy=`pairing`,this.textChunkLimit=4e3,this.chunkMode=`newline`,this.historyLimit=50,this.dmHistoryLimit=10,this.mediaMaxMb=5,this.dms={},this.allowedUpdates=``,this.saving=!1,this.status=`disconnected`,this.botName=`Awaiting Token Setup...`,this.pairings=[],this.newOverrideUserId=``,this.newOverrideLimit=10,this.wsClient=j.getInstance(),this.activePreviewBlocks=[],this.mediaLogs=[],this.reactionLogs=[],this.reactionNotifications=!1,this.pollInterval=null}static{this.styles=s`
    :host {
      display: flex;
      flex-direction: column;
      gap: 2rem;
      padding-bottom: 3rem;
    }

    .title {
      font-family: var(--font-display);
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 0.5rem;
    }

    .subtitle {
      font-size: 0.95rem;
      color: var(--text-secondary);
      margin-top: -1.5rem;
      margin-bottom: 1.5rem;
    }

    .card {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 2rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .section-title {
      font-family: var(--font-display);
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-primary);
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .channel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 1rem;
    }

    .channel-title-group {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .channel-icon {
      font-size: 2.2rem;
    }

    .channel-name {
      font-family: var(--font-display);
      font-size: 1.3rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .badge {
      font-size: 0.8rem;
      font-weight: 700;
      padding: 0.25rem 0.75rem;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .badge.connected {
      background-color: var(--status-green-glow);
      color: var(--status-green);
      border: 1px solid rgba(0, 255, 102, 0.2);
    }

    .badge.error {
      background-color: var(--status-red-glow);
      color: var(--status-red);
      border: 1px solid rgba(255, 51, 102, 0.2);
    }

    .badge.disconnected {
      background-color: rgba(100, 116, 139, 0.1);
      color: var(--text-muted);
      border: 1px solid var(--border-color);
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
    }

    .grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 1.5rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-secondary);
    }

    input, select {
      width: 100%;
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      padding: 0.65rem 0.85rem;
      outline: none;
      font-family: var(--font-sans);
      font-size: 0.9rem;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    input:focus, select:focus {
      border-color: var(--accent-primary);
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
    }

    .btn {
      background-color: var(--accent-primary);
      border: 1px solid var(--accent-primary);
      color: var(--text-primary);
      padding: 0.65rem 1.4rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .btn:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    .btn:active {
      transform: translateY(0);
    }

    .btn:disabled {
      background-color: var(--text-muted);
      border-color: var(--text-muted);
      cursor: not-allowed;
      transform: none;
    }

    .btn-secondary {
      background-color: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
    }

    .btn-secondary:hover {
      background-color: rgba(255, 255, 255, 0.05);
      color: var(--text-primary);
    }

    .btn-danger {
      background-color: var(--status-red-glow);
      border-color: rgba(255, 51, 102, 0.3);
      color: var(--status-red);
    }

    .btn-danger:hover {
      background-color: rgba(255, 51, 102, 0.2);
    }

    .help-text {
      font-size: 0.8rem;
      color: var(--text-muted);
      line-height: 1.4;
    }

    /* Table styles */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 0.5rem;
    }

    th, td {
      text-align: left;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border-color);
      font-size: 0.9rem;
    }

    th {
      font-weight: 600;
      color: var(--text-secondary);
    }

    td {
      color: var(--text-primary);
    }

    .no-data {
      text-align: center;
      color: var(--text-muted);
      padding: 2rem;
      font-style: italic;
    }

    .pairings-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .pairing-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 0.75rem 1.25rem;
    }

    .pairing-info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .pairing-code {
      font-family: monospace;
      font-weight: 700;
      color: var(--accent-primary);
      font-size: 1.05rem;
    }
  `}connectedCallback(){super.connectedCallback(),this.loadConfig(),this.loadPairings(),this.loadLiveLogs(),this.pollInterval=setInterval(()=>{this.loadLiveLogs()},3e3)}disconnectedCallback(){this.pollInterval&&=(clearInterval(this.pollInterval),null)}async loadLiveLogs(){let e=this.wsClient.getToken();try{let t=await fetch(`${this.wsClient.getGatewayUrl()}/api/rpc`,{method:`POST`,headers:{"Content-Type":`application/json`,Authorization:`Bearer ${e}`},body:JSON.stringify({jsonrpc:`2.0`,method:`getActivePreviewBlocks`,params:{},id:`dash_list_preview_blocks`})});if(t.ok){let e=await t.json();this.activePreviewBlocks=e.result?.list||[]}let n=await fetch(`${this.wsClient.getGatewayUrl()}/api/rpc`,{method:`POST`,headers:{"Content-Type":`application/json`,Authorization:`Bearer ${e}`},body:JSON.stringify({jsonrpc:`2.0`,method:`getTelegramLogs`,params:{},id:`dash_get_telegram_logs`})});if(n.ok){let e=await n.json();this.mediaLogs=e.result?.mediaLogs||[],this.reactionLogs=e.result?.reactionLogs||[]}}catch(e){console.warn(`[Channels] Failed to load live logs:`,e)}}async loadConfig(){let e=this.wsClient.getToken();try{let t=await fetch(`${this.wsClient.getGatewayUrl()}/api/config`,{method:`GET`,headers:{Authorization:`Bearer ${e}`}});if(t.ok){let e=await t.json();if(this.config=e.config,this.baseHash=e.hash,this.config.channels?.telegram){let e=this.config.channels.telegram;this.botToken=e.botToken||``,this.mode=e.mode||`polling`,this.webhookDomain=e.webhookDomain||``,this.allowFrom=(e.allowFrom||[]).join(`, `),this.groupPolicy=e.groupPolicy||`allowlist`,this.dmPolicy=e.dmPolicy||`pairing`,this.textChunkLimit=e.textChunkLimit??4e3,this.chunkMode=e.chunkMode||`newline`,this.historyLimit=e.historyLimit??50,this.dmHistoryLimit=e.dmHistoryLimit??10,this.mediaMaxMb=e.mediaMaxMb??5,this.dms=e.dms||{},this.allowedUpdates=(e.allowed_updates||[`message`,`callback_query`,`message_reaction`]).join(`, `),this.reactionNotifications=e.reactionNotifications??!1}this.validateTelegramToken()}}catch(e){console.error(`[Channels] Failed to load configuration:`,e)}}async validateTelegramToken(){if(!this.botToken){this.status=`disconnected`,this.botName=`Awaiting Token Setup...`;return}try{let e=await(await fetch(`https://api.telegram.org/bot${this.botToken}/getMe`)).json();e.ok?(this.status=`connected`,this.botName=`@${e.result.username} (${e.result.first_name})`):(this.status=`error`,this.botName=`Invalid Bot Token`)}catch{this.status=`error`,this.botName=`Telegram API Unreachable`}}async loadPairings(){let e=this.wsClient.getToken();try{let t=await fetch(`${this.wsClient.getGatewayUrl()}/api/rpc`,{method:`POST`,headers:{"Content-Type":`application/json`,Authorization:`Bearer ${e}`},body:JSON.stringify({jsonrpc:`2.0`,method:`listPairings`,params:{},id:`dash_list_pairings`})});if(t.ok){let e=await t.json();this.pairings=e.result||[]}}catch(e){console.error(`[Channels] Failed to load pairings:`,e)}}async approvePairing(e,t){let n=this.wsClient.getToken();try{(await fetch(`${this.wsClient.getGatewayUrl()}/api/rpc`,{method:`POST`,headers:{"Content-Type":`application/json`,Authorization:`Bearer ${n}`},body:JSON.stringify({jsonrpc:`2.0`,method:`approvePairing`,params:{code:e,agentId:t},id:`dash_approve_pairing`})})).ok?(alert(`Pairing approved successfully for agent '${t}'!`),await this.loadPairings(),await this.loadConfig()):alert(`Failed to approve pairing.`)}catch(e){console.error(`[Channels] Failed to approve pairing:`,e)}}async addOverride(){if(!this.newOverrideUserId.trim()){alert(`Please specify a valid Telegram User ID.`);return}let e=this.newOverrideUserId.trim();this.dms={...this.dms,[e]:{historyLimit:Number(this.newOverrideLimit)}},this.newOverrideUserId=``,this.newOverrideLimit=10}removeOverride(e){let t={...this.dms};delete t[e],this.dms=t}async saveConfig(){if(this.saving)return;this.saving=!0;let e=this.wsClient.getToken(),t=this.allowFrom?this.allowFrom.split(`,`).map(e=>Number(e.trim())).filter(e=>!isNaN(e)):[],n=this.allowedUpdates?this.allowedUpdates.split(`,`).map(e=>e.trim()).filter(Boolean):[`message`,`callback_query`,`message_reaction`],r={...this.config,channels:{...this.config.channels,telegram:{botToken:this.botToken,mode:this.mode,webhookDomain:this.webhookDomain,allowFrom:t,groupPolicy:this.groupPolicy,dmPolicy:this.dmPolicy,textChunkLimit:Number(this.textChunkLimit),chunkMode:this.chunkMode,historyLimit:Number(this.historyLimit),dmHistoryLimit:Number(this.dmHistoryLimit),mediaMaxMb:Number(this.mediaMaxMb),dms:this.dms,allowed_updates:n,reactionNotifications:this.reactionNotifications}}};try{let t=await fetch(`${this.wsClient.getGatewayUrl()}/api/config`,{method:`POST`,headers:{"Content-Type":`application/json`,Authorization:`Bearer ${e}`},body:JSON.stringify({config:r,baseHash:this.baseHash})});if(t.status===409)alert(`Conflict Error: The configuration has been modified by another process. Reloading settings...`),await this.loadConfig();else if(t.ok){let e=await t.json();this.baseHash=e.hash,alert(`Configuration saved successfully. Telegram bot has been re-initialized.`),await this.validateTelegramToken()}else alert(`Failed to save configuration.`)}catch(e){console.error(`[Channels] Failed to save configuration:`,e)}finally{this.saving=!1}}render(){return S`
      <div>
        <div class="title">Connected Integrations & Channels</div>
        <div class="subtitle">Configure communication policies, transport envelopes, history limits, and paired users.</div>
      </div>

      <div class="card">
        <div class="channel-header">
          <div class="channel-title-group">
            <span class="channel-icon">✈️</span>
            <div>
              <div class="channel-name">Telegram Bot Bridge</div>
              <div style="font-size: 0.85rem; color: var(--text-secondary)">${this.botName}</div>
            </div>
          </div>
          <div>
            <span class="badge ${this.status}">${this.status.toUpperCase()}</span>
          </div>
        </div>

        <!-- 1. Bot Credentials & Connection Settings -->
        <div class="section-title">Bot Configuration & Transport</div>
        <div class="grid-2">
          <div class="form-group">
            <label for="botToken">Telegram Bot Token</label>
            <input 
              type="password" 
              id="botToken" 
              placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ" 
              .value=${this.botToken}
              @input=${e=>this.botToken=e.target.value}
            />
            <span class="help-text">Obtain a bot token by messaging @BotFather on Telegram.</span>
          </div>

          <div class="form-group">
            <label for="mode">Transport Mode</label>
            <select id="mode" .value=${this.mode} @change=${e=>this.mode=e.target.value}>
              <option value="polling">Long Polling (runner-based)</option>
              <option value="webhook">Webhook Integration (Express-routed)</option>
            </select>
            <span class="help-text">Polling runs in a FIFO concurrent queue. Webhooks require public accessibility.</span>
          </div>
        </div>

        ${this.mode===`webhook`?S`
          <div class="form-group">
            <label for="webhookDomain">Public Webhook URL Domain Root</label>
            <input 
              type="text" 
              id="webhookDomain" 
              placeholder="e.g. https://my-server.com" 
              .value=${this.webhookDomain}
              @input=${e=>this.webhookDomain=e.target.value}
            />
            <span class="help-text">Must be an https:// domain pointing directly to this Gateway host port.</span>
          </div>
        `:null}

        <!-- 2. Gating and Policy configuration -->
        <div class="section-title">Access Policy & Allow-Lists</div>
        <div class="grid-2">
          <div class="form-group">
            <label for="dmPolicy">Direct Message (DM) Policy</label>
            <select id="dmPolicy" .value=${this.dmPolicy} @change=${e=>this.dmPolicy=e.target.value}>
              <option value="pairing">Interactive Pairing Mode</option>
              <option value="deny">Deny Unapproved Users</option>
            </select>
            <span class="help-text">Pairing mode sends verification setup codes to unknown accounts.</span>
          </div>

          <div class="form-group">
            <label for="groupPolicy">Group Chat Policy</label>
            <select id="groupPolicy" .value=${this.groupPolicy} @change=${e=>this.groupPolicy=e.target.value}>
              <option value="allowlist">Allowlist Only (ignores other groups)</option>
            </select>
            <span class="help-text">Only allowlisted group IDs will trigger agent ReAct cycles.</span>
          </div>
        </div>

        <div class="form-group">
          <label for="allowFrom">Authorized Numeric Chat & User IDs (Allowlist)</label>
          <input 
            type="text" 
            id="allowFrom" 
            placeholder="e.g. 123456789, 987654321, -1001928374" 
            .value=${this.allowFrom}
            @input=${e=>this.allowFrom=e.target.value}
          />
          <span class="help-text">Comma-separated list of authorized chat or user numeric IDs. Unlisted users will trigger security policies.</span>
        </div>

        <!-- 3. Message Framing & History Limits -->
        <div class="section-title">Envelopes & History Settings</div>
        <div class="grid-3">
          <div class="form-group">
            <label for="textChunkLimit">Outbound Text Chunk Limit</label>
            <input 
              type="number" 
              id="textChunkLimit" 
              min="500" 
              max="4096"
              .value=${this.textChunkLimit}
              @input=${e=>this.textChunkLimit=e.target.value}
            />
          </div>

          <div class="form-group">
            <label for="chunkMode">Chunk Separation Mode</label>
            <select id="chunkMode" .value=${this.chunkMode} @change=${e=>this.chunkMode=e.target.value}>
              <option value="newline">Newline Boundaries</option>
              <option value="hard">Hard Character Chop</option>
            </select>
          </div>

          <div class="form-group">
            <label for="mediaMaxMb">Max Attachment Size (MB)</label>
            <input 
              type="number" 
              id="mediaMaxMb" 
              min="1" 
              max="50"
              .value=${this.mediaMaxMb}
              @input=${e=>this.mediaMaxMb=e.target.value}
            />
          </div>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label for="historyLimit">Group Chat History Limit (messages)</label>
            <input 
              type="number" 
              id="historyLimit" 
              min="5" 
              max="200"
              .value=${this.historyLimit}
              @input=${e=>this.historyLimit=e.target.value}
            />
          </div>

          <div class="form-group">
            <label for="dmHistoryLimit">Direct Message (DM) History Limit (turns)</label>
            <input 
              type="number" 
              id="dmHistoryLimit" 
              min="1" 
              max="50"
              .value=${this.dmHistoryLimit}
              @input=${e=>this.dmHistoryLimit=e.target.value}
            />
          </div>
        </div>

        <div class="form-group">
          <label for="allowedUpdates">Allowed Telegram Updates</label>
          <input 
            type="text" 
            id="allowedUpdates" 
            placeholder="e.g. message, callback_query, message_reaction" 
            .value=${this.allowedUpdates}
            @input=${e=>this.allowedUpdates=e.target.value}
          />
          <span class="help-text">Comma-separated list of updates to receive. Must include <code>message_reaction</code> to process message reactions.</span>
        </div>

        <!-- 4. Interactive Pairing Queue Management -->
        <div class="section-title">Pending Pairings Queue</div>
        <div class="pairings-list">
          ${this.pairings.filter(e=>e.status===`pending`).length===0?S`
            <div class="no-data">No pending pairings awaiting authorization.</div>
          `:this.pairings.filter(e=>e.status===`pending`).map(e=>S`
            <div class="pairing-item">
              <div class="pairing-info">
                <div>Code: <span class="pairing-code">${e.code}</span></div>
                <div style="font-size: 0.8rem; color: var(--text-secondary)">Agent ID: <code>${e.agentId}</code> | User ID: <code>${e.telegramUserId}</code></div>
                <div style="font-size: 0.75rem; color: var(--text-muted)">Requested: ${new Date(e.requestedAt).toLocaleTimeString()} (Expires ${new Date(e.expiresAt).toLocaleTimeString()})</div>
              </div>
              <button class="btn btn-secondary" @click=${()=>this.approvePairing(e.code,e.agentId)}>✅ Approve</button>
            </div>
          `)}
        </div>

        <!-- 5. User-level History Override Table -->
        <div class="section-title">Per-DM History Overrides</div>
        <div class="grid-3" style="align-items: flex-end">
          <div class="form-group">
            <label for="newOverrideUserId">Telegram User ID</label>
            <input 
              type="text" 
              id="newOverrideUserId" 
              placeholder="e.g. 987654321" 
              .value=${this.newOverrideUserId}
              @input=${e=>this.newOverrideUserId=e.target.value}
            />
          </div>
          <div class="form-group">
            <label for="newOverrideLimit">History Limit (turns)</label>
            <input 
              type="number" 
              id="newOverrideLimit" 
              min="1" 
              max="100" 
              .value=${this.newOverrideLimit}
              @input=${e=>this.newOverrideLimit=Number(e.target.value)}
            />
          </div>
          <button class="btn btn-secondary" @click=${this.addOverride}>➕ Add Override</button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Telegram User ID</th>
              <th>Turn History Limit</th>
              <th style="width: 100px">Action</th>
            </tr>
          </thead>
          <tbody>
            ${Object.keys(this.dms).length===0?S`
              <tr>
                <td colspan="3" class="no-data">No per-user history overrides configured.</td>
              </tr>
            `:Object.entries(this.dms).map(([e,t])=>S`
              <tr>
                <td><code>${e}</code></td>
                <td>
                  <input 
                    type="number" 
                    min="1" 
                    max="100"
                    style="width: 80px; padding: 0.3rem;"
                    .value=${t.historyLimit}
                    @input=${t=>{this.dms={...this.dms,[e]:{historyLimit:Number(t.target.value)}}}}
                  />
                </td>
                <td>
                  <button class="btn btn-danger btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem" @click=${()=>this.removeOverride(e)}>🗑️ Remove</button>
                </td>
              </tr>
            `)}
          </tbody>
        </table>

        <!-- Submit Save -->
        <button class="btn" style="margin-top: 1rem" ?disabled=${this.saving} @click=${this.saveConfig}>
          ${this.saving?`Saving Configuration...`:`💾 Save Settings`}
        </button>
      </div>

      <!-- 6. Dual-Tier Streaming & Reactions Center -->
      <div class="card">
        <div class="section-title">📺 Dual-Tier Streaming & Reaction Monitor</div>
        
        <!-- Reaction Configuration -->
        <div class="form-group" style="flex-direction: row; align-items: center; gap: 1rem; background-color: var(--bg-primary); padding: 1rem; border: 1px solid var(--border-color); border-radius: 6px;">
          <input 
            type="checkbox" 
            id="reactionNotifications" 
            style="width: 20px; height: 20px; cursor: pointer; margin-right: 0.5rem;"
            .checked=${this.reactionNotifications}
            @change=${e=>this.reactionNotifications=e.target.checked}
          />
          <div>
            <label for="reactionNotifications" style="cursor: pointer; font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">Enable Reaction Notifications</label>
            <span class="help-text" style="display: block; margin-top: 0.25rem;">Monitor and log inbound Telegram reactions into session memory logs (requires 'message_reaction' in Allowed Updates).</span>
          </div>
        </div>

        <div class="grid-2">
          <!-- Active Preview Blocks -->
          <div>
            <div style="font-weight: 600; color: var(--text-secondary); margin-bottom: 0.5rem; font-size: 0.95rem;">Active Preview Streaming Blocks</div>
            <div style="background-color: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; padding: 1rem; max-height: 250px; overflow-y: auto;">
              ${this.activePreviewBlocks.length===0?S`
                <div style="color: var(--text-muted); font-size: 0.85rem; font-style: italic; text-align: center; padding: 1rem;">No active typing streaming sessions.</div>
              `:this.activePreviewBlocks.map(e=>S`
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding: 0.5rem 0; font-size: 0.85rem;">
                  <div>
                    <div style="font-weight: bold; color: var(--accent-primary);">${e.agentId}</div>
                    <div style="color: var(--text-secondary); font-family: monospace; font-size: 0.75rem;">${e.sessionId}</div>
                  </div>
                  <div style="text-align: right;">
                    <span style="font-size: 0.75rem; background: rgba(99, 102, 241, 0.15); color: var(--accent-primary); padding: 2px 6px; border-radius: 4px; font-weight: bold;">
                      Rotations: ${e.rotationCount}
                    </span>
                  </div>
                </div>
              `)}
            </div>
          </div>

          <!-- Recent Reactions Log -->
          <div>
            <div style="font-weight: 600; color: var(--text-secondary); margin-bottom: 0.5rem; font-size: 0.95rem;">Recent Reaction Events</div>
            <div style="background-color: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; padding: 1rem; max-height: 250px; overflow-y: auto;">
              ${this.reactionLogs.length===0?S`
                <div style="color: var(--text-muted); font-size: 0.85rem; font-style: italic; text-align: center; padding: 1rem;">No recent reaction updates.</div>
              `:this.reactionLogs.map(e=>S`
                <div style="border-bottom: 1px solid var(--border-color); padding: 0.5rem 0; font-size: 0.85rem; line-height: 1.4;">
                  <div style="display: flex; justify-content: space-between;">
                    <strong style="color: var(--text-primary);">${e.fromUser}</strong>
                    <span style="color: var(--text-muted); font-size: 0.75rem;">${new Date(e.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div style="color: var(--text-secondary); font-size: 0.8rem;">
                    Reacted <span style="background: rgba(255, 255, 255, 0.1); padding: 2px 4px; border-radius: 4px; font-weight: bold;">${e.reactions.join(` `)}</span> on msg #${e.messageId}
                  </div>
                  <div style="color: var(--text-muted); font-size: 0.7rem; font-family: monospace;">Session: ${e.sessionId}</div>
                </div>
              `)}
            </div>
          </div>
        </div>

        <!-- Block Streaming Media Logs -->
        <div>
          <div style="font-weight: 600; color: var(--text-secondary); margin-bottom: 0.5rem; font-size: 0.95rem;">Block Streaming Media Delivery Log</div>
          <div style="overflow-x: auto; background-color: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px;">
            <table style="width: 100%; font-size: 0.85rem; border-collapse: collapse;">
              <thead>
                <tr style="background-color: var(--bg-tertiary);">
                  <th style="padding: 0.5rem 0.75rem;">Time</th>
                  <th style="padding: 0.5rem 0.75rem;">Agent</th>
                  <th style="padding: 0.5rem 0.75rem;">Path</th>
                  <th style="padding: 0.5rem 0.75rem;">Type</th>
                  <th style="padding: 0.5rem 0.75rem;">Idempotency Key / Dedup</th>
                  <th style="padding: 0.5rem 0.75rem;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${this.mediaLogs.length===0?S`
                  <tr>
                    <td colspan="6" style="text-align: center; color: var(--text-muted); font-style: italic; padding: 1rem;">No media deliveries logged.</td>
                  </tr>
                `:this.mediaLogs.map(e=>S`
                  <tr>
                    <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border-color);">${new Date(e.timestamp).toLocaleTimeString()}</td>
                    <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border-color);"><strong>${e.agentId}</strong></td>
                    <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border-color); font-family: monospace; font-size: 0.75rem;">${e.mediaPath}</td>
                    <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border-color);"><span style="text-transform: capitalize;">${e.mediaType}</span></td>
                    <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border-color); font-family: monospace; font-size: 0.7rem; color: var(--text-secondary);">${e.idempotencyKey}</td>
                    <td style="padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border-color);">
                      <span style="color: ${e.success?`var(--status-green)`:`var(--status-red)`}; font-weight: bold;">
                        ${e.success?`DELIVERED / DEDUPED`:`FAILED`}
                      </span>
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Scaffolded Discord and Slack integration cards -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem">
        <div class="card" style="opacity: 0.55; filter: grayscale(1)">
          <div class="channel-header">
            <div class="channel-title-group">
              <span class="channel-icon">👾</span>
              <div>
                <div class="channel-name">Discord Channel App</div>
                <div style="font-size: 0.8rem; color: var(--text-muted)">Support coming soon...</div>
              </div>
            </div>
            <span class="badge disconnected">INACTIVE</span>
          </div>
        </div>

        <div class="card" style="opacity: 0.55; filter: grayscale(1)">
          <div class="channel-header">
            <div class="channel-title-group">
              <span class="channel-icon">💬</span>
              <div>
                <div class="channel-name">Slack App Workspace</div>
                <div style="font-size: 0.8rem; color: var(--text-muted)">Support coming soon...</div>
              </div>
            </div>
            <span class="badge disconnected">INACTIVE</span>
          </div>
        </div>
      </div>
    `}};e([A()],F.prototype,`config`,void 0),e([A()],F.prototype,`baseHash`,void 0),e([A()],F.prototype,`botToken`,void 0),e([A()],F.prototype,`mode`,void 0),e([A()],F.prototype,`webhookDomain`,void 0),e([A()],F.prototype,`allowFrom`,void 0),e([A()],F.prototype,`groupPolicy`,void 0),e([A()],F.prototype,`dmPolicy`,void 0),e([A()],F.prototype,`textChunkLimit`,void 0),e([A()],F.prototype,`chunkMode`,void 0),e([A()],F.prototype,`historyLimit`,void 0),e([A()],F.prototype,`dmHistoryLimit`,void 0),e([A()],F.prototype,`mediaMaxMb`,void 0),e([A()],F.prototype,`dms`,void 0),e([A()],F.prototype,`allowedUpdates`,void 0),e([A()],F.prototype,`saving`,void 0),e([A()],F.prototype,`status`,void 0),e([A()],F.prototype,`botName`,void 0),e([A()],F.prototype,`pairings`,void 0),e([A()],F.prototype,`newOverrideUserId`,void 0),e([A()],F.prototype,`newOverrideLimit`,void 0),e([A()],F.prototype,`activePreviewBlocks`,void 0),e([A()],F.prototype,`mediaLogs`,void 0),e([A()],F.prototype,`reactionLogs`,void 0),e([A()],F.prototype,`reactionNotifications`,void 0),F=e([k(`channels-page`)],F);var I=class extends O{constructor(...e){super(...e),this.instances=[],this.filteredInstances=[],this.refreshing=!1,this.filterAgent=``,this.filterStatus=``,this.bulkActionMsg=``,this.bulkActionPending=!1,this.wsClient=j.getInstance(),this.pollInterval=null}static{this.styles=s`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .title {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .controls-right {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      flex-wrap: wrap;
    }

    /* Filter bar */
    .filter-bar {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 0.75rem 1rem;
    }

    .filter-label {
      font-size: 0.8rem;
      color: var(--text-muted);
      white-space: nowrap;
    }

    select {
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      padding: 0.4rem 0.6rem;
      outline: none;
      font-size: 0.85rem;
      cursor: pointer;
    }

    /* Bulk-action banner */
    .bulk-banner {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      flex-wrap: wrap;
    }

    .bulk-banner .label {
      font-size: 0.85rem;
      color: var(--text-secondary);
      flex: 1;
    }

    .bulk-banner .status-msg {
      font-size: 0.82rem;
      padding: 0.25rem 0.65rem;
      border-radius: 4px;
      background: rgba(0, 255, 102, 0.1);
      color: var(--status-green);
      border: 1px solid rgba(0, 255, 102, 0.2);
    }

    .table-card {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    th {
      background-color: var(--bg-tertiary);
      color: var(--text-secondary);
      font-weight: 600;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 1rem;
      border-bottom: 1px solid var(--border-color);
    }

    td {
      padding: 0.85rem 1rem;
      border-bottom: 1px solid var(--border-color);
      font-size: 0.9rem;
      color: var(--text-primary);
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover td {
      background-color: rgba(255, 255, 255, 0.02);
    }

    /* Duplicate row highlight */
    tr.is-duplicate td {
      background-color: rgba(255, 165, 0, 0.06) !important;
    }

    tr.is-duplicate td:first-child {
      border-left: 3px solid rgba(255, 165, 0, 0.7);
    }

    .dup-badge {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.15rem 0.4rem;
      border-radius: 3px;
      background: rgba(255, 165, 0, 0.15);
      color: #ffaa00;
      border: 1px solid rgba(255, 165, 0, 0.3);
      margin-left: 0.4rem;
      vertical-align: middle;
    }

    /* Badges */
    .badge {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      display: inline-block;
    }

    .badge.running {
      background-color: var(--status-green-glow);
      color: var(--status-green);
      border: 1px solid rgba(0, 255, 102, 0.2);
    }

    .badge.idle {
      background-color: rgba(100, 116, 139, 0.1);
      color: var(--text-muted);
      border: 1px solid var(--border-color);
    }

    .badge.crashed, .badge.failed {
      background-color: var(--status-red-glow);
      color: var(--status-red);
      border: 1px solid rgba(255, 51, 102, 0.2);
    }

    .badge.unresponsive {
      background-color: rgba(255, 165, 0, 0.1);
      color: #ffaa00;
      border: 1px solid rgba(255, 165, 0, 0.25);
    }

    /* Buttons */
    .btn {
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      font-size: 0.8rem;
      transition: all 0.2s;
      white-space: nowrap;
    }

    .btn:hover {
      background-color: var(--border-color);
    }

    .btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .btn-stop {
      color: var(--status-red);
      border-color: rgba(255, 51, 102, 0.3);
    }

    .btn-stop:hover:not(:disabled) {
      background-color: var(--status-red-glow);
    }

    .btn-restart {
      color: var(--accent-secondary);
      border-color: rgba(0, 240, 255, 0.3);
    }

    .btn-restart:hover:not(:disabled) {
      background-color: var(--accent-secondary-glow);
    }

    .btn-warn {
      color: #ffaa00;
      border-color: rgba(255, 165, 0, 0.35);
    }

    .btn-warn:hover:not(:disabled) {
      background-color: rgba(255, 165, 0, 0.1);
    }

    .btn-danger {
      color: var(--status-red);
      border-color: rgba(255, 51, 102, 0.4);
      font-weight: 600;
    }

    .btn-danger:hover:not(:disabled) {
      background-color: var(--status-red-glow);
    }

    .action-group {
      display: flex;
      gap: 0.5rem;
    }

    code {
      font-family: var(--font-mono);
      font-size: 0.85rem;
      background: var(--bg-primary);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      color: var(--accent-secondary);
    }

    .empty-state {
      text-align: center;
      color: var(--text-muted);
      padding: 3rem;
      font-size: 0.9rem;
    }

    .stats-row {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .stat-chip {
      font-size: 0.78rem;
      padding: 0.25rem 0.65rem;
      border-radius: 4px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
    }

    .stat-chip span {
      color: var(--text-primary);
      font-weight: 600;
    }

    .stat-chip.warn span {
      color: #ffaa00;
    }

    .stat-chip.danger span {
      color: var(--status-red);
    }
  `}connectedCallback(){super.connectedCallback(),this.refreshTelemetry(),this.pollInterval=setInterval(this.refreshTelemetry.bind(this),3e3)}disconnectedCallback(){super.disconnectedCallback(),this.pollInterval&&clearInterval(this.pollInterval)}async refreshTelemetry(){if(!this.refreshing){this.refreshing=!0;try{this.instances=await this.wsClient.send(`getAgentsTelemetry`),this.applyFilters()}catch(e){console.error(`[Instances] Failed to fetch active processes:`,e)}finally{this.refreshing=!1}}}applyFilters(){this.filteredInstances=this.instances.filter(e=>!(this.filterAgent&&e.agentId!==this.filterAgent||this.filterStatus&&e.status!==this.filterStatus))}getDuplicateAgentIds(){let e=new Map;for(let t of this.instances)e.set(t.agentId,(e.get(t.agentId)??0)+1);let t=new Set;for(let[n,r]of e)r>1&&t.add(n);return t}async stopAgent(e){if(confirm(`Are you sure you want to stop this agent process lane?`))try{await this.wsClient.send(`stopAgent`,{sessionId:e}),this.setBulkMsg(`Stop command dispatched.`),await this.refreshTelemetry()}catch(e){alert(`Failed to stop agent: ${e.message}`)}}async restartAgent(e,t){if(confirm(`Are you sure you want to restart this agent process lane?`))try{await this.wsClient.send(`restartAgent`,{agentId:e,sessionId:t}),this.setBulkMsg(`Restart command dispatched.`),await this.refreshTelemetry()}catch(e){alert(`Failed to restart agent: ${e.message}`)}}async killDuplicates(){if(confirm(`This will terminate all duplicate process lanes per agent, keeping only the most recently started one. Continue?`)){this.bulkActionPending=!0;try{let e=await this.wsClient.send(`killDuplicateInstances`,{});this.setBulkMsg(`Killed ${e.killed} duplicate instance(s).`),await this.refreshTelemetry()}catch(e){alert(`Failed: ${e.message}`)}finally{this.bulkActionPending=!1}}}async killAllIdle(){if(confirm(`This will terminate all idle, crashed, and failed process lanes. Running sessions will not be affected. Continue?`)){this.bulkActionPending=!0;try{let e=await this.wsClient.send(`killAllIdleInstances`,{});this.setBulkMsg(`Killed ${e.killed} idle/crashed/failed instance(s).`),await this.refreshTelemetry()}catch(e){alert(`Failed: ${e.message}`)}finally{this.bulkActionPending=!1}}}async killAllForAgent(e){if(e&&confirm(`This will terminate ALL process lanes for agent "${e}". Continue?`)){this.bulkActionPending=!0;try{let t=await this.wsClient.send(`killAgentInstances`,{agentId:e});this.setBulkMsg(`Killed ${t.killed} instance(s) for agent '${e}'.`),await this.refreshTelemetry()}catch(e){alert(`Failed: ${e.message}`)}finally{this.bulkActionPending=!1}}}setBulkMsg(e){this.bulkActionMsg=e,setTimeout(()=>{this.bulkActionMsg=``},4e3)}formatUptime(e){let t=Math.floor(e/1e3);return`${Math.floor(t/60)}m ${t%60}s`}formatLastActivity(e){if(e<0)return`Just now`;let t=Math.floor(e/1e3);return t<60?`${t}s ago`:`${Math.floor(t/60)}m ago`}render(){let e=Array.from(new Set(this.instances.map(e=>e.agentId))),t=this.getDuplicateAgentIds(),n=this.instances.filter(e=>e.status===`running`).length,r=this.instances.filter(e=>e.status===`idle`||e.status===`crashed`||e.status===`failed`).length,i=Array.from(t).reduce((e,t)=>e+this.instances.filter(e=>e.agentId===t).length-1,0);return S`
      <div class="title-row">
        <div class="title">Process Pool Supervisor</div>
        <div class="controls-right">
          <button class="btn" @click=${this.refreshTelemetry} ?disabled=${this.refreshing}>
            ${this.refreshing?`🔄 Refreshing...`:`🔄 Refresh`}
          </button>
        </div>
      </div>

      <!-- Stats summary row -->
      <div class="stats-row">
        <div class="stat-chip">Total <span>${this.instances.length}</span></div>
        <div class="stat-chip">Running <span>${n}</span></div>
        <div class="stat-chip ${r>0?`warn`:``}">Idle / Crashed <span>${r}</span></div>
        <div class="stat-chip ${i>0?`warn`:``}">Duplicates <span>${i}</span></div>
        <div class="stat-chip">Shown <span>${this.filteredInstances.length}</span></div>
      </div>

      <!-- Bulk action bar -->
      <div class="bulk-banner">
        <span class="label">🛠️ Bulk Actions</span>

        <button
          class="btn btn-warn"
          @click=${this.killDuplicates}
          ?disabled=${this.bulkActionPending||i===0}
          title="Kill all duplicate process lanes, keeping the most recently started one per agent"
        >
          🗑 Kill Duplicates ${i>0?`(${i})`:``}
        </button>

        <button
          class="btn btn-danger"
          @click=${this.killAllIdle}
          ?disabled=${this.bulkActionPending||r===0}
          title="Terminate all idle, crashed, and failed process lanes"
        >
          ⚡ Kill Idle / Crashed ${r>0?`(${r})`:``}
        </button>

        ${this.filterAgent?S`
          <button
            class="btn btn-danger"
            @click=${()=>this.killAllForAgent(this.filterAgent)}
            ?disabled=${this.bulkActionPending}
            title="Terminate all instances for the currently filtered agent"
          >
            💀 Kill All for "${this.filterAgent}"
          </button>
        `:``}

        ${this.bulkActionMsg?S`<span class="status-msg">${this.bulkActionMsg}</span>`:``}
      </div>

      <!-- Filters -->
      <div class="filter-bar">
        <span class="filter-label">Filter by:</span>
        <select
          .value=${this.filterAgent}
          @change=${e=>{this.filterAgent=e.target.value,this.applyFilters()}}
        >
          <option value="">All Agents</option>
          ${e.map(e=>S`<option value=${e}>${e}${t.has(e)?` ⚠ dup`:``}</option>`)}
        </select>

        <select
          .value=${this.filterStatus}
          @change=${e=>{this.filterStatus=e.target.value,this.applyFilters()}}
        >
          <option value="">All Statuses</option>
          <option value="running">Running</option>
          <option value="idle">Idle</option>
          <option value="crashed">Crashed</option>
          <option value="failed">Failed</option>
          <option value="unresponsive">Unresponsive</option>
        </select>
      </div>

      <div class="table-card">
        <table>
          <thead>
            <tr>
              <th>Agent ID</th>
              <th>Session ID</th>
              <th>PID</th>
              <th>RAM</th>
              <th>CPU%</th>
              <th>Uptime</th>
              <th>Last Activity</th>
              <th>Restarts</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${this.filteredInstances.length===0?S`
              <tr>
                <td colspan="10" class="empty-state">
                  ${this.filterAgent||this.filterStatus?`No instances match the current filter.`:`No active agent sessions are running in the pool. Message your bots to initialize.`}
                </td>
              </tr>
            `:this.filteredInstances.map(e=>{let n=t.has(e.agentId);return S`
                <tr class=${n?`is-duplicate`:``}>
                  <td>
                    <strong>${e.agentId}</strong>
                    ${n?S`<span class="dup-badge">DUP</span>`:``}
                  </td>
                  <td><span style="font-family: var(--font-mono); font-size: 0.8rem">${e.sessionId}</span></td>
                  <td><code>${e.pid||`N/A`}</code></td>
                  <td>${e.ramUsageMb} MB</td>
                  <td>${e.cpuPercent.toFixed(1)}%</td>
                  <td>${this.formatUptime(e.uptimeMs)}</td>
                  <td>${this.formatLastActivity(e.lastActivityMsAgo)}</td>
                  <td>${e.restarts}</td>
                  <td><span class="badge ${e.status}">${e.status.toUpperCase()}</span></td>
                  <td>
                    <div class="action-group">
                      <button class="btn btn-restart" @click=${()=>this.restartAgent(e.agentId,e.sessionId)}>🔄 Restart</button>
                      <button class="btn btn-stop" @click=${()=>this.stopAgent(e.sessionId)}>🛑 Stop</button>
                    </div>
                  </td>
                </tr>
              `})}
          </tbody>
        </table>
      </div>
    `}};e([A()],I.prototype,`instances`,void 0),e([A()],I.prototype,`filteredInstances`,void 0),e([A()],I.prototype,`refreshing`,void 0),e([A()],I.prototype,`filterAgent`,void 0),e([A()],I.prototype,`filterStatus`,void 0),e([A()],I.prototype,`bulkActionMsg`,void 0),e([A()],I.prototype,`bulkActionPending`,void 0),I=e([k(`instances-page`)],I);var L=class extends O{constructor(...e){super(...e),this.sessions=[],this.filteredSessions=[],this.selectedSession=null,this.transcript=[],this.loadingTranscript=!1,this.searchTranscriptQuery=``,this.loading=!1,this.bulkMsg=``,this.bulkPending=!1,this.filterAgent=``,this.filterChannel=``,this.searchSessionQuery=``,this.wsClient=j.getInstance()}static{this.styles=s`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      height: 100%;
    }

    .title {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    /* Container for split view */
    .session-layout {
      display: flex;
      gap: 1.5rem;
      flex: 1;
      height: calc(100vh - 180px);
      overflow: hidden;
    }

    .sessions-list-panel {
      flex: 1;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .transcript-panel {
      width: 450px;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Filter Bar */
    .filter-bar {
      display: flex;
      gap: 0.5rem;
      padding: 1rem;
      border-bottom: 1px solid var(--border-color);
      background-color: var(--bg-tertiary);
    }

    select, input {
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      padding: 0.4rem 0.6rem;
      outline: none;
      font-size: 0.85rem;
    }

    input {
      flex: 1;
    }

    /* Sessions Table */
    .table-container {
      flex: 1;
      overflow-y: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    th {
      background-color: var(--bg-tertiary);
      color: var(--text-secondary);
      font-weight: 600;
      font-size: 0.8rem;
      text-transform: uppercase;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border-color);
    }

    td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border-color);
      font-size: 0.85rem;
      cursor: pointer;
    }

    tr.selected td {
      background-color: var(--accent-glow);
    }

    tr:hover td {
      background-color: rgba(255, 255, 255, 0.01);
    }

    /* Transcript Box Styles */
    .transcript-header {
      padding: 1rem;
      border-bottom: 1px solid var(--border-color);
      background-color: var(--bg-tertiary);
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .transcript-turns {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      background-color: var(--bg-primary);
    }

    .turn {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      max-width: 85%;
      border-radius: var(--border-radius);
      padding: 0.75rem;
    }

    .turn.user {
      align-self: flex-end;
      background-color: var(--accent-primary);
      color: white;
    }

    .turn.model {
      align-self: flex-start;
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
    }

    .turn.tool {
      align-self: flex-start;
      background-color: rgba(0, 240, 255, 0.05);
      border: 1px solid rgba(0, 240, 255, 0.15);
      color: var(--accent-secondary);
      font-family: var(--font-mono);
      font-size: 0.75rem;
      max-width: 95%;
    }

    .turn-meta {
      font-size: 0.7rem;
      color: rgba(255, 255, 255, 0.6);
      align-self: flex-end;
    }

    .turn.model .turn-meta {
      color: var(--text-muted);
    }

    .highlight {
      background-color: rgba(255, 204, 0, 0.3);
      border-bottom: 2px solid var(--status-yellow);
    }

    .delete-btn {
      background: transparent;
      border: none;
      color: var(--status-red, #ff4d4d);
      cursor: pointer;
      font-size: 1.15rem;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .delete-btn:hover {
      background-color: rgba(255, 77, 77, 0.15);
      transform: scale(1.15);
    }

    /* Bulk action bar */
    .bulk-bar {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.65rem 1rem;
      background: var(--bg-tertiary);
      border-bottom: 1px solid var(--border-color);
      flex-wrap: wrap;
    }

    .bulk-label {
      font-size: 0.78rem;
      color: var(--text-muted);
      white-space: nowrap;
    }

    .btn {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 0.35rem 0.75rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      font-size: 0.78rem;
      transition: all 0.2s;
      white-space: nowrap;
    }

    .btn:hover {
      background-color: var(--border-color);
    }

    .btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .btn-danger {
      color: var(--status-red);
      border-color: rgba(255, 51, 102, 0.35);
    }

    .btn-danger:hover:not(:disabled) {
      background-color: var(--status-red-glow);
    }

    .btn-warn {
      color: #ffaa00;
      border-color: rgba(255, 165, 0, 0.35);
    }

    .btn-warn:hover:not(:disabled) {
      background-color: rgba(255, 165, 0, 0.1);
    }

    .session-count {
      margin-left: auto;
      font-size: 0.75rem;
      color: var(--text-muted);
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
    }

    .bulk-status {
      font-size: 0.78rem;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      background: rgba(0, 255, 102, 0.08);
      color: var(--status-green);
      border: 1px solid rgba(0, 255, 102, 0.2);
    }
  `}connectedCallback(){super.connectedCallback(),this.loadSessions()}async loadSessions(){this.loading=!0;try{let e=await this.wsClient.send(`listSessions`);this.sessions=e,this.applyFilters()}catch(e){console.error(`[Sessions] Failed to list sessions:`,e)}finally{this.loading=!1}}async deleteSession(e){if(confirm(`Are you sure you want to permanently delete session "${e.sessionId}"? This will terminate any active processes and wipe the history.`))try{await this.wsClient.send(`deleteSession`,{agentId:e.agentId,sessionId:e.sessionId}),this.selectedSession?.sessionId===e.sessionId&&(this.selectedSession=null,this.transcript=[]),await this.loadSessions()}catch(e){console.error(`[Sessions] Failed to delete session:`,e),alert(`Error deleting session: ${e.message||e}`)}}async deleteAllForAgent(e){let t=this.sessions.filter(t=>t.agentId===e).length;if(!confirm(`This will permanently delete all ${t} session(s) for agent "${e}". This cannot be undone. Continue?`))return;this.bulkPending=!0;let n=0,r=this.sessions.filter(t=>t.agentId===e);for(let e of r)try{await this.wsClient.send(`deleteSession`,{agentId:e.agentId,sessionId:e.sessionId}),n++,this.selectedSession?.sessionId===e.sessionId&&(this.selectedSession=null,this.transcript=[])}catch(t){console.warn(`[Sessions] Failed to delete ${e.sessionId}:`,t)}this.setBulkMsg(`Deleted ${n} of ${r.length} session(s) for "${e}".`),this.bulkPending=!1,await this.loadSessions()}async deleteAllIdle(){let e=this.sessions.filter(e=>!e.active);if(e.length===0){alert(`No idle sessions to delete.`);return}if(!confirm(`This will permanently delete ${e.length} idle session(s). Continue?`))return;this.bulkPending=!0;let t=0;for(let n of e)try{await this.wsClient.send(`deleteSession`,{agentId:n.agentId,sessionId:n.sessionId}),t++,this.selectedSession?.sessionId===n.sessionId&&(this.selectedSession=null,this.transcript=[])}catch{}this.setBulkMsg(`Deleted ${t} idle session(s).`),this.bulkPending=!1,await this.loadSessions()}setBulkMsg(e){this.bulkMsg=e,setTimeout(()=>{this.bulkMsg=``},4500)}applyFilters(){this.filteredSessions=this.sessions.filter(e=>{if(this.filterAgent&&e.agentId!==this.filterAgent)return!1;let t=e.sessionId.split(`:`)[1]||``;if(this.filterChannel&&!t.includes(this.filterChannel))return!1;if(this.searchSessionQuery){let t=this.searchSessionQuery.toLowerCase();return e.sessionId.toLowerCase().includes(t)||e.lastText.toLowerCase().includes(t)}return!0})}async selectSession(e){this.selectedSession=e,this.loadingTranscript=!0,this.transcript=[];try{let t=await this.wsClient.send(`getSessionTranscript`,{agentId:e.agentId,sessionId:e.sessionId});this.transcript=t}catch(e){console.error(`[Sessions] Failed to get session transcript:`,e)}finally{this.loadingTranscript=!1}}renderHighlight(e){if(!this.searchTranscriptQuery)return S`${e}`;let t=this.searchTranscriptQuery.toLowerCase();return S`${e.split(RegExp(`(${t})`,`gi`)).map(e=>e.toLowerCase()===t?S`<span class="highlight">${e}</span>`:e)}`}getSessionScopeKey(e){if(e.startsWith(`agent:`)){let t=e.split(`:`);if(t[2]===`telegram`){let e=t[3],n=t[4];return t[5]===`topic`?`${e}:${n} (thread:${t[6]})`:`${e}:${n}`}}let t=e.split(`:`);return t[2]||t[1]||`default`}getSessionScopeType(e){return e.includes(`:telegram:dm:`)?`dm`:e.includes(`:telegram:group:`)?e.includes(`:topic:`)?`group+topic`:`group`:`web / other`}render(){let e=Array.from(new Set(this.sessions.map(e=>e.agentId))),t=this.sessions.filter(e=>!e.active).length,n=this.sessions.filter(e=>e.active).length;return S`
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem">
        <div class="title">Active Conversation Log Sessions</div>
        <button class="btn" @click=${this.loadSessions} ?disabled=${this.loading}>
          ${this.loading?`🔄 Loading...`:`🔄 Refresh`}
        </button>
      </div>

      <div class="session-layout">
        <!-- Sessions List Panel -->
        <div class="sessions-list-panel">
          <div class="filter-bar">
            <input 
              type="text" 
              placeholder="Search session ID or messages..." 
              .value=${this.searchSessionQuery}
              @input=${e=>{this.searchSessionQuery=e.target.value,this.applyFilters()}}
            />
            
            <select .value=${this.filterAgent} @change=${e=>{this.filterAgent=e.target.value,this.applyFilters()}}>
              <option value="">All Agents</option>
              ${e.map(e=>S`<option value=${e}>${e}</option>`)}
            </select>

            <select .value=${this.filterChannel} @change=${e=>{this.filterChannel=e.target.value,this.applyFilters()}}>
              <option value="">All Channels</option>
              <option value="chat">WebChat</option>
              <option value="telegram">Telegram</option>
              <option value="cron">Cron Scheduler</option>
            </select>
          </div>

          <!-- Bulk action bar -->
          <div class="bulk-bar">
            <span class="bulk-label">🛠️ Bulk:</span>

            <button
              class="btn btn-danger"
              @click=${this.deleteAllIdle}
              ?disabled=${this.bulkPending||t===0}
              title="Delete all idle (non-running) sessions permanently"
            >
              🗑 Delete Idle ${t>0?`(${t})`:``}
            </button>

            ${this.filterAgent?S`
              <button
                class="btn btn-danger"
                @click=${()=>this.deleteAllForAgent(this.filterAgent)}
                ?disabled=${this.bulkPending}
                title="Delete all sessions for the selected agent"
              >
                💀 Delete All for "${this.filterAgent}"
              </button>
            `:``}

            ${this.bulkMsg?S`<span class="bulk-status">${this.bulkMsg}</span>`:``}

            <span class="session-count">
              ${this.filteredSessions.length} / ${this.sessions.length} sessions
              &nbsp;·&nbsp; ${n} running &nbsp;·&nbsp; ${t} idle
            </span>
          </div>

          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Agent ID</th>
                  <th>Session ID</th>
                  <th>Scope Key</th>
                  <th>Scope Type</th>
                  <th>Execution</th>
                  <th>Runtime</th>
                  <th>Channel</th>
                  <th>Queue Mode</th>
                  <th>Streaming</th>
                  <th>Reasoning</th>
                  <th>Debounce</th>
                  <th>Status</th>
                  <th>Turns</th>
                  <th>Last Message Time</th>
                  <th>Last Message Preview</th>
                  <th style="width: 80px; text-align: center">Action</th>
                </tr>
              </thead>
              <tbody>
                ${this.filteredSessions.length===0?S`
                  <tr>
                    <td colspan="16" style="text-align: center; color: var(--text-muted); padding: 2rem">
                      No matching conversation sessions found.
                    </td>
                  </tr>
                `:this.filteredSessions.map(e=>S`
                  <tr 
                    class=${this.selectedSession?.sessionId===e.sessionId?`selected`:``}
                    @click=${()=>this.selectSession(e)}
                  >
                    <td><strong>${e.agentId}</strong></td>
                    <td><span style="font-family: var(--font-mono); font-size: 0.8rem">${e.sessionId}</span></td>
                    <td><code style="font-size: 0.8rem">${this.getSessionScopeKey(e.sessionId)}</code></td>
                    <td><span style="color: var(--accent-primary); font-size: 0.8rem; font-weight: 600">${this.getSessionScopeType(e.sessionId)}</span></td>
                    <td><span style="color: var(--accent-secondary); font-size: 0.8rem">${e.execution||`gemini/gemini-3.5-flash`}</span></td>
                    <td><code style="font-size: 0.8rem">${e.runtime||`komorebi`}</code></td>
                    <td><span style="text-transform: capitalize; font-size: 0.8rem">${e.channel||`web`}</span></td>
                    <td><span style="font-size: 0.8rem; text-transform: uppercase">${e.queueMode||`followup`}</span></td>
                    <td><span style="font-size: 0.8rem">${e.blockStreaming?`Stream`:`Complete`}</span></td>
                    <td><span style="font-size: 0.8rem; text-transform: capitalize">${e.reasoning||`off`}</span></td>
                    <td><span style="font-size: 0.8rem">${e.debounceMs||2e3}ms</span></td>
                    <td>
                      <span class=${e.active?`badge-running`:`badge-idle`} style="font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; font-weight: bold; background-color: ${e.active?`rgba(0, 230, 115, 0.15)`:`rgba(255, 255, 255, 0.05)`}; color: ${e.active?`#00e673`:`var(--text-muted)`}">
                        ${e.active?`RUNNING`:`IDLE`}
                      </span>
                    </td>
                    <td>${e.turns}</td>
                    <td>${new Date(e.lastMessageTime).toLocaleTimeString()}</td>
                    <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-secondary)">
                      ${e.lastText}
                    </td>
                    <td style="text-align: center">
                      <button 
                        class="delete-btn" 
                        @click=${t=>{t.stopPropagation(),this.deleteSession(e)}}
                        title="Delete Session"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Transcript Viewer Panel -->
        <div class="transcript-panel">
          ${this.selectedSession?S`
            <div class="transcript-header">
              <div style="font-weight: 600; font-family: var(--font-display); color: var(--text-primary)">
                Transcript Viewer
              </div>
              <div style="font-size: 0.75rem; color: var(--text-secondary); font-family: var(--font-mono)">
                ${this.selectedSession.sessionId}
              </div>
              <input 
                type="text" 
                placeholder="Search within transcript..." 
                .value=${this.searchTranscriptQuery}
                @input=${e=>this.searchTranscriptQuery=e.target.value}
                style="padding: 0.35rem 0.5rem; font-size: 0.8rem; margin-top: 0.25rem"
              />
            </div>

            <div class="transcript-turns">
              ${this.loadingTranscript?S`
                <div style="text-align: center; padding: 2rem; color: var(--text-muted)">
                  Loading transcripts...
                </div>
              `:this.transcript.length===0?S`
                <div style="text-align: center; padding: 2rem; color: var(--text-muted)">
                  Empty transcript record.
                </div>
              `:this.transcript.map(e=>S`
                <div class="turn ${e.role}">
                  <div style="font-size: 0.85rem">${this.renderHighlight(e.content)}</div>
                  
                  ${e.toolCalls?e.toolCalls.map(e=>S`
                    <div style="margin-top: 0.5rem; padding: 0.4rem; background: rgba(0,0,0,0.2); border-radius: 4px; font-family: var(--font-mono); font-size: 0.75rem; border-left: 2px solid var(--accent-primary)">
                      🛠️ Tool Call: <strong>${e.name}</strong>(${JSON.stringify(e.arguments)})
                    </div>
                  `):``}
                  
                  ${e.timestamp?S`
                    <span class="turn-meta">${new Date(e.timestamp).toLocaleTimeString()}</span>
                  `:``}
                </div>
              `)}
            </div>
          `:S`
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); font-size: 0.9rem; padding: 2rem; text-align: center">
              Select a conversation session row to open the log transcript and review details.
            </div>
          `}
        </div>
      </div>
    `}};e([A()],L.prototype,`sessions`,void 0),e([A()],L.prototype,`filteredSessions`,void 0),e([A()],L.prototype,`selectedSession`,void 0),e([A()],L.prototype,`transcript`,void 0),e([A()],L.prototype,`loadingTranscript`,void 0),e([A()],L.prototype,`searchTranscriptQuery`,void 0),e([A()],L.prototype,`loading`,void 0),e([A()],L.prototype,`bulkMsg`,void 0),e([A()],L.prototype,`bulkPending`,void 0),e([A()],L.prototype,`filterAgent`,void 0),e([A()],L.prototype,`filterChannel`,void 0),e([A()],L.prototype,`searchSessionQuery`,void 0),L=e([k(`sessions-page`)],L);var Ve=[`UTC`,`Asia/Kolkata`,`Asia/Tokyo`,`Asia/Singapore`,`Europe/London`,`Europe/Berlin`,`America/New_York`,`America/Los_Angeles`,`America/Chicago`,`Australia/Sydney`,`Pacific/Auckland`],R=class extends O{constructor(...e){super(...e),this.jobs=[],this.selectedJob=null,this.selectedJobTasks=[],this.isEditing=!1,this.agents=[],this.liveNotification=null,this.isGeneratingPrompt=!1,this.revealWebhookToken=!1,this.driftReport=null,this.boundaryWarnings=[],this.schedulePreview=``,this.scheduleValid=!0,this.activeTab=`details`,this.formId=``,this.formName=``,this.formAgentId=``,this.formSchedule=`0 9 * * *`,this.formTimezone=`Asia/Kolkata`,this.formType=`session`,this.formPayload=``,this.formDynamicPayload=!1,this.formDeliveryMode=`announce`,this.formChannel=``,this.formWebhookUrl=``,this.formWebhookToken=``,this.formEnabled=!0,this.wsClient=j.getInstance()}static{this.styles=s`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    /* ── Layout ── */
    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .title {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    .layout {
      display: grid;
      grid-template-columns: 1fr 420px;
      gap: 1.25rem;
      align-items: start;
    }

    /* ── Panels ── */
    .panel {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 1.25rem;
    }
    .panel-header {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.75rem;
    }

    /* ── Job Cards ── */
    .job-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .job-card {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 0.85rem 1rem;
      cursor: pointer;
      transition: all 0.18s;
      position: relative;
    }
    .job-card:hover { border-color: var(--accent-primary); transform: translateY(-1px); }
    .job-card.selected { border-color: var(--accent-primary); box-shadow: 0 0 0 2px rgba(99,102,241,0.2); }
    .job-card.running {
      border-color: #f59e0b;
      animation: pulse-border 1.5s ease-in-out infinite;
    }
    @keyframes pulse-border {
      0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.3); }
      50%      { box-shadow: 0 0 0 4px rgba(245,158,11,0.1); }
    }
    .job-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem; }
    .job-name { font-weight: 600; color: var(--text-primary); font-size: 0.95rem; }
    .job-badges { display: flex; gap: 0.3rem; align-items: center; flex-wrap: wrap; }
    .job-meta { font-size: 0.78rem; color: var(--text-muted); display: flex; gap: 1rem; margin-top: 0.25rem; }
    .job-meta strong { color: var(--text-secondary); }
    .next-run { font-size: 0.78rem; color: var(--text-muted); margin-top: 0.35rem; display: flex; align-items: center; gap: 0.3rem; }

    /* ── Badges ── */
    .badge {
      font-size: 0.68rem; font-weight: 700;
      padding: 0.12rem 0.45rem; border-radius: 4px;
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .badge-active   { background: rgba(16,185,129,0.15); color: #10b981; }
    .badge-disabled { background: rgba(100,116,139,0.1); color: var(--text-muted); }
    .badge-backoff  { background: rgba(245,158,11,0.15); color: #f59e0b; }
    .badge-failing  { background: rgba(239,68,68,0.15);  color: #ef4444; }
    .badge-running  { background: rgba(245,158,11,0.2);  color: #f59e0b; }
    .badge-session  { background: rgba(99,102,241,0.12); color: var(--accent-primary); }
    .badge-isolated { background: rgba(139,92,246,0.12); color: #8b5cf6; }
    .badge-command  { background: rgba(20,184,166,0.12); color: #14b8a6; }
    .badge-announce { background: rgba(59,130,246,0.12); color: #3b82f6; }
    .badge-webhook  { background: rgba(168,85,247,0.12); color: #a855f7; }
    .badge-none     { background: rgba(100,116,139,0.08); color: var(--text-muted); }

    /* ── Tabs ── */
    .tabs {
      display: flex; gap: 0; border-bottom: 1px solid var(--border-color);
      margin-bottom: 1rem;
    }
    .tab {
      padding: 0.4rem 0.85rem; font-size: 0.82rem; font-weight: 600;
      cursor: pointer; border-bottom: 2px solid transparent;
      color: var(--text-muted); transition: all 0.15s;
    }
    .tab:hover { color: var(--text-primary); }
    .tab.active { color: var(--accent-primary); border-bottom-color: var(--accent-primary); }

    /* ── Forms ── */
    .form-group { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.85rem; }
    label { font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); }
    input, select, textarea {
      background: var(--bg-primary); border: 1px solid var(--border-color);
      border-radius: 6px; color: var(--text-primary);
      padding: 0.45rem 0.6rem; outline: none;
      font-size: 0.88rem; font-family: var(--font-sans);
      transition: border-color 0.15s;
    }
    input:focus, select:focus, textarea:focus { border-color: var(--accent-primary); }
    input.invalid { border-color: #ef4444 !important; }
    textarea { resize: vertical; min-height: 75px; }
    .schedule-preview {
      font-size: 0.75rem; padding: 0.3rem 0.5rem;
      border-radius: 4px; margin-top: 0.2rem;
    }
    .schedule-preview.valid   { background: rgba(16,185,129,0.1); color: #10b981; }
    .schedule-preview.invalid { background: rgba(239,68,68,0.1);   color: #ef4444; }
    .type-grid {
      display: grid; grid-template-columns: repeat(3,1fr); gap: 0.4rem;
    }
    .type-btn {
      padding: 0.5rem 0.3rem; border: 1px solid var(--border-color);
      border-radius: 6px; cursor: pointer; text-align: center;
      font-size: 0.78rem; font-weight: 600; transition: all 0.15s;
      background: var(--bg-tertiary); color: var(--text-secondary);
    }
    .type-btn:hover { border-color: var(--accent-primary); }
    .type-btn.selected { border-color: var(--accent-primary); background: rgba(99,102,241,0.12); color: var(--accent-primary); }
    .delivery-grid {
      display: grid; grid-template-columns: repeat(3,1fr); gap: 0.4rem;
    }
    .delivery-btn {
      padding: 0.45rem 0.3rem; border: 1px solid var(--border-color);
      border-radius: 6px; cursor: pointer; text-align: center;
      font-size: 0.78rem; font-weight: 600; transition: all 0.15s;
      background: var(--bg-tertiary); color: var(--text-secondary);
    }
    .delivery-btn.selected { border-color: var(--accent-primary); background: rgba(99,102,241,0.12); color: var(--accent-primary); }

    /* ── Buttons ── */
    .btn {
      background: var(--bg-tertiary); border: 1px solid var(--border-color);
      color: var(--text-primary); padding: 0.38rem 0.75rem;
      border-radius: 6px; cursor: pointer; font-weight: 500;
      font-size: 0.83rem; transition: all 0.18s;
    }
    .btn:hover { background: var(--border-color); }
    .btn-primary { background: var(--accent-primary); border-color: var(--accent-primary); color: #fff; }
    .btn-primary:hover { opacity: 0.88; }
    .btn-danger { color: #ef4444; border-color: rgba(239,68,68,0.3); }
    .btn-danger:hover { background: rgba(239,68,68,0.1); }
    .btn-sm { padding: 0.2rem 0.5rem; font-size: 0.75rem; }
    .btn-row { display: flex; gap: 0.5rem; flex-wrap: wrap; }

    /* ── Task history ── */
    .task-list { display: flex; flex-direction: column; gap: 0.4rem; max-height: 260px; overflow-y: auto; }
    .task-item {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding: 0.45rem 0.6rem;
      background: var(--bg-primary); border-radius: 5px;
      font-size: 0.75rem; border-left: 3px solid var(--border-color);
    }
    .task-item.completed { border-left-color: #10b981; }
    .task-item.failed    { border-left-color: #ef4444; }
    .task-item.running   { border-left-color: #f59e0b; }
    .task-item.resumed   { border-left-color: #8b5cf6; }
    .task-drift { font-size: 0.68rem; color: var(--text-muted); }
    .task-drift.high { color: #f59e0b; }

    /* ── Drift monitor ── */
    .drift-widget {
      background: var(--bg-tertiary); border: 1px solid var(--border-color);
      border-radius: 8px; padding: 0.85rem; margin-top: 0.75rem;
    }
    .drift-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
    .drift-title { font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); }
    .drift-stats { display: flex; gap: 1rem; font-size: 0.75rem; }
    .drift-stat { display: flex; flex-direction: column; align-items: center; }
    .drift-stat-val { font-size: 1rem; font-weight: 700; color: var(--accent-primary); }
    .drift-stat-lbl { font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; }
    .drift-bar-container { display: flex; gap: 2px; height: 32px; align-items: flex-end; margin-top: 0.5rem; }
    .drift-bar { flex: 1; background: rgba(99,102,241,0.4); border-radius: 2px 2px 0 0; min-height: 2px; transition: height 0.3s; }
    .drift-bar.high { background: rgba(245,158,11,0.7); }
    .drift-bar.critical { background: rgba(239,68,68,0.7); }

    /* ── Warnings ── */
    .warning-badge {
      background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.3);
      border-radius: 6px; padding: 0.5rem 0.75rem;
      font-size: 0.78rem; color: #f59e0b; margin-bottom: 0.5rem;
    }
    .warning-badge details summary { cursor: pointer; font-weight: 600; }
    .warning-badge .suggestion { color: var(--text-secondary); margin-top: 0.3rem; font-style: italic; }

    /* ── Backoff state ── */
    .backoff-visual {
      display: flex; gap: 0.3rem; align-items: center;
      margin: 0.5rem 0; flex-wrap: wrap;
    }
    .backoff-step {
      font-size: 0.7rem; padding: 0.15rem 0.4rem;
      border-radius: 4px; border: 1px solid var(--border-color);
      color: var(--text-muted);
    }
    .backoff-step.done    { background: rgba(239,68,68,0.12); color: #ef4444; border-color: rgba(239,68,68,0.3); }
    .backoff-step.current { background: rgba(245,158,11,0.15); color: #f59e0b; border-color: rgba(245,158,11,0.4); font-weight: 700; }
    .backoff-step.pending { opacity: 0.4; }

    /* ── Webhook section ── */
    .webhook-box {
      background: var(--bg-tertiary); border: 1px dashed var(--border-color);
      border-radius: 6px; padding: 0.75rem; display: flex;
      flex-direction: column; gap: 0.5rem;
    }
    .mono { font-family: var(--font-mono); font-size: 0.78rem; word-break: break-all; }

    /* ── Notifications ── */
    .live-notification {
      background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1));
      border: 1px solid rgba(99,102,241,0.4); border-radius: 8px;
      padding: 0.55rem 1rem; font-size: 0.85rem; color: var(--text-primary);
      display: flex; align-items: center; gap: 0.5rem;
      animation: slide-in 0.3s ease;
    }
    @keyframes slide-in {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `}connectedCallback(){super.connectedCallback(),this.loadAll(),this.subscribeToBusEvents(),this.refreshTimer=window.setInterval(()=>this.loadAll(),3e4),this.countdownTimer=window.setInterval(()=>this.requestUpdate(),5e3)}disconnectedCallback(){super.disconnectedCallback(),this.busListener&&this.wsClient.removeEventListener(this.busListener),this.refreshTimer&&clearInterval(this.refreshTimer),this.countdownTimer&&clearInterval(this.countdownTimer)}subscribeToBusEvents(){this.busListener=(e,t)=>{if(e!==`cron_event`)return;let n=t?.event,r=t?.data;if(n===`cron_started`)this.showNotification(`⚡ Running: "${r?.name}"`),this.loadAll();else if(n===`cron_completed`){let e=r?.success?`✅`:`❌`;this.showNotification(`${e} "${r?.name}" (${r?.durationMs}ms)`),this.loadAll(),this.selectedJob?.id===r?.jobId&&this.loadTasks(r.jobId)}},this.wsClient.addEventListener(this.busListener)}showNotification(e){this.liveNotification=e,setTimeout(()=>{this.liveNotification===e&&(this.liveNotification=null)},5e3)}async loadAll(){try{let[e,t,n,r]=await Promise.allSettled([this.wsClient.send(`listCronJobs`),this.wsClient.send(`getSystemConfig`),this.wsClient.send(`getCronDriftReport`),this.wsClient.send(`getCronBoundaryWarnings`)]);if(e.status===`fulfilled`&&(this.jobs=e.value,this.selectedJob)){let e=this.jobs.find(e=>e.id===this.selectedJob.id);e&&(this.selectedJob=e)}t.status===`fulfilled`&&(this.agents=t.value?.config?.agents??[],this.agents.length&&!this.formAgentId&&(this.formAgentId=this.agents[0].id)),n.status===`fulfilled`&&(this.driftReport=n.value),r.status===`fulfilled`&&(this.boundaryWarnings=r.value?.warnings??[])}catch(e){console.error(`[CronPage] loadAll failed:`,e)}}async loadTasks(e){try{let t=await this.wsClient.send(`getCronTasks`,{jobId:e});this.selectedJobTasks=(t?.tasks??[]).reverse()}catch{this.selectedJobTasks=[]}}async selectJob(e){this.selectedJob=e,this.isEditing=!1,this.revealWebhookToken=!1,this.activeTab=`details`,await this.loadTasks(e.id)}startNewJob(){this.selectedJob=null,this.isEditing=!0,this.formId=crypto.randomUUID(),this.formName=``,this.formAgentId=this.agents[0]?.id??``,this.formSchedule=`0 9 * * *`,this.formTimezone=`Asia/Kolkata`,this.formType=`session`,this.formPayload=``,this.formDynamicPayload=!1,this.formDeliveryMode=`announce`,this.formChannel=``,this.formWebhookUrl=``,this.formWebhookToken=`kore_${Math.random().toString(36).slice(2,14)}`,this.formEnabled=!0,this.schedulePreview=``,this.scheduleValid=!0}editJob(e){this.isEditing=!0,this.formId=e.id,this.formName=e.name,this.formAgentId=e.agentId,this.formSchedule=e.schedule??e.expression??``,this.formTimezone=e.timezone??`Asia/Kolkata`,this.formType=e.type??`session`,this.formPayload=e.payload??e.prompt??``,this.formDynamicPayload=!!e.dynamicPayload,this.formDeliveryMode=e.deliveryMode??`announce`,this.formChannel=e.channel??``,this.formWebhookUrl=e.webhookUrl??``,this.formWebhookToken=e.webhookToken??``,this.formEnabled=e.enabled,this.validateSchedule(this.formSchedule)}async validateSchedule(e){if(this.formSchedule=e,!e){this.schedulePreview=``;return}try{let t=await this.wsClient.send(`validateCronSchedule`,{schedule:e,timezone:this.formTimezone});this.scheduleValid=t.valid,this.schedulePreview=t.valid?t.human??e:`Invalid cron expression`}catch{this.schedulePreview=``}}async saveJob(){if(!this.formName||!this.formSchedule||!this.formPayload){alert(`Please fill in Name, Schedule, and Payload/Command.`);return}if(!this.scheduleValid){alert(`Please enter a valid cron expression.`);return}let e={id:this.formId,name:this.formName,agentId:this.formAgentId,schedule:this.formSchedule,timezone:this.formTimezone,type:this.formType,payload:this.formPayload,dynamicPayload:this.formDynamicPayload,deliveryMode:this.formDeliveryMode,channel:this.formChannel||void 0,webhookUrl:this.formWebhookUrl||void 0,webhookToken:this.formWebhookToken,enabled:this.formEnabled,status:this.formEnabled?`active`:`disabled`,createdAt:Date.now(),expression:this.formSchedule,prompt:this.formPayload};try{await this.wsClient.send(`saveCronJob`,{job:e}),this.isEditing=!1,await this.loadAll();let t=this.jobs.find(e=>e.id===this.formId);t&&this.selectJob(t)}catch(e){alert(`Error saving job: ${e.message}`)}}async deleteJob(e){confirm(`Delete this cron job? This cannot be undone.`)&&(await this.wsClient.send(`deleteCronJob`,{jobId:e}),this.selectedJob=null,this.loadAll())}async runNow(e){try{await this.wsClient.send(`runCronJob`,{jobId:e}),this.showNotification(`⚡ Manual trigger sent`),this.loadAll()}catch(e){alert(`Trigger failed: ${e.message}`)}}async toggleEnabled(e){let t=e.enabled?`disableCronJob`:`enableCronJob`;await this.wsClient.send(t,{jobId:e.id}),this.loadAll()}async generatePayloadWithAI(){let e=prompt(`Briefly describe what this cron job should do:`);if(e?.trim()){this.isGeneratingPrompt=!0;try{let t=await this.wsClient.send(`queryAgentModel`,{agentId:this.formAgentId,systemInstruction:`Write a detailed, operational step-by-step cron task prompt for an autonomous AI agent. Be concise and direct.`,prompt:e.trim()});t.success&&t.text?this.formPayload=t.text.trim():alert(`AI generation returned an empty response.`)}catch(e){alert(`AI error: ${e.message}`)}finally{this.isGeneratingPrompt=!1}}}formatRelative(e){if(!e)return`—`;let t=e-Date.now();if(Math.abs(t)<5e3)return`now`;let n=Math.abs(t),r=t<0,i=Math.floor(n/6e4),a=Math.floor(i/60),o=Math.floor(a/24),s=o>0?`${o}d ${a%24}h`:a>0?`${a}h ${i%60}m`:i>0?`${i}m`:`<1 min`;return r?`${s} ago`:`in ${s}`}formatTs(e){return e?new Date(e).toLocaleString():`Never`}getStatusBadgeClass(e){return e.isRunning?`badge-running`:{active:`badge-active`,backoff:`badge-backoff`,failing:`badge-failing`,disabled:`badge-disabled`,completed:`badge-active`}[e.status]??`badge-disabled`}getStatusLabel(e){return e.isRunning?`RUNNING`:{active:`ACTIVE`,backoff:`BACKOFF`,failing:`FAILING`,disabled:`DISABLED`,completed:`DONE`}[e.status]??e.status.toUpperCase()}getGatewayBaseUrl(){let{protocol:e,hostname:t,port:n}=window.location;return n?`${e}//${t}:${n}`:`${e}//${t}`}render(){return S`
      <div class="title-row">
        <div class="title">⏰ Cron Scheduler</div>
        <div style="display:flex;gap:0.5rem">
          <button class="btn" @click=${()=>this.loadAll()}>↻ Refresh</button>
          <button class="btn btn-primary" @click=${this.startNewJob}>➕ New Job</button>
        </div>
      </div>

      ${this.liveNotification?S`
        <div class="live-notification">🔔 ${this.liveNotification}</div>`:``}

      ${this.boundaryWarnings.length>0?S`
        <div>
          ${this.boundaryWarnings.map(e=>S`
            <div class="warning-badge">
              <details>
                <summary>⚠️ <strong>${e.jobName}</strong>: ${e.issue}</summary>
                <div class="suggestion">💡 ${e.suggestion}</div>
              </details>
            </div>
          `)}
        </div>`:``}

      <div class="layout">
        <!-- Job list -->
        <div>
          <div class="job-list">
            ${this.jobs.length===0?S`
              <div style="text-align:center;color:var(--text-muted);padding:3rem">
                No cron jobs configured. Click <strong>New Job</strong> to create one.
              </div>`:this.jobs.map(e=>S`
              <div
                class="job-card ${this.selectedJob?.id===e.id?`selected`:``} ${e.isRunning?`running`:``}"
                @click=${()=>this.selectJob(e)}
              >
                <div class="job-card-top">
                  <span class="job-name">${e.name}</span>
                  <div class="job-badges">
                    ${e.isRunning?S`<span class="badge badge-running">RUNNING</span>`:``}
                    <span class="badge ${this.getStatusBadgeClass(e)}">${this.getStatusLabel(e)}</span>
                    <span class="badge badge-${e.type??`session`}">${(e.type??`session`).toUpperCase()}</span>
                    <span class="badge badge-${e.deliveryMode??`none`}">${(e.deliveryMode??`none`).toUpperCase()}</span>
                  </div>
                </div>
                <div class="job-meta">
                  <span>🤖 <strong>${e.agentId}</strong></span>
                  <span style="font-family:var(--font-mono)">${e.schedule??e.expression}</span>
                  ${e.consecutiveFailures>0?S`<span style="color:#ef4444">⚠️ ${e.consecutiveFailures} failure(s)</span>`:``}
                </div>
                ${e.enabled&&e.nextRun?S`
                  <div class="next-run">⏰ Next: <strong>${this.formatRelative(e.nextRun)}</strong>
                    <span style="opacity:0.6">· ${this.formatTs(e.nextRun)}</span>
                  </div>`:``}
                ${e.humanSchedule?S`<div style="font-size:0.73rem;color:var(--text-muted);margin-top:0.2rem">📅 ${e.humanSchedule}</div>`:``}
              </div>
            `)}
          </div>

          ${this.renderDriftWidget()}
        </div>

        <!-- Detail / form panel -->
        <div class="panel" style="position:sticky;top:1rem">
          ${this.isEditing?this.renderForm():this.renderDetails()}
        </div>
      </div>
    `}renderDriftWidget(){if(!this.driftReport)return S``;let e=this.driftReport,t=e.samples.slice(-40),n=Math.max(...t.map(e=>e.driftMs),1),r=3e3,i=5e3;return S`
      <div class="drift-widget">
        <div class="drift-header">
          <span class="drift-title">📊 Scheduler Drift (24h)</span>
          <span style="font-size:0.7rem;color:var(--text-muted)">${t.length} samples</span>
        </div>
        <div class="drift-stats">
          <div class="drift-stat">
            <span class="drift-stat-val" style="${e.avgDriftMs>r?`color:#f59e0b`:``}">${e.avgDriftMs.toFixed(0)}ms</span>
            <span class="drift-stat-lbl">avg</span>
          </div>
          <div class="drift-stat">
            <span class="drift-stat-val" style="${e.p95DriftMs>i?`color:#ef4444`:``}">${e.p95DriftMs.toFixed(0)}ms</span>
            <span class="drift-stat-lbl">p95</span>
          </div>
          <div class="drift-stat">
            <span class="drift-stat-val" style="${e.maxDriftMs>i?`color:#ef4444`:``}">${e.maxDriftMs.toFixed(0)}ms</span>
            <span class="drift-stat-lbl">max</span>
          </div>
        </div>
        ${t.length>0?S`
          <div class="drift-bar-container">
            ${t.map(e=>{let t=Math.min(e.driftMs/n*100,100);return S`<div class="drift-bar ${e.driftMs>i?`critical`:e.driftMs>r?`high`:``}" style="height:${Math.max(t,4)}%;" title="${e.driftMs}ms"></div>`})}
          </div>
          ${e.avgDriftMs>r?S`
            <div style="font-size:0.73rem;color:#f59e0b;margin-top:0.4rem">
              ⚠️ High drift detected — possible Pi 5 CPU contention. Run <code>komorebi cron drift-report</code> for details.
            </div>`:``}
        `:S`<div style="font-size:0.75rem;color:var(--text-muted);text-align:center;padding:0.5rem">No samples yet</div>`}
      </div>
    `}renderDetails(){if(!this.selectedJob)return S`
        <div style="display:flex;align-items:center;justify-content:center;min-height:200px;color:var(--text-muted);font-size:0.9rem;text-align:center">
          Select a job from the list to view details, task history, and delivery config.
        </div>`;let e=this.selectedJob;return S`
      <div style="display:flex;flex-direction:column;gap:1rem">
        <div style="border-bottom:1px solid var(--border-color);padding-bottom:0.6rem">
          <div style="font-family:var(--font-display);font-size:1.1rem;font-weight:700">${e.name}</div>
          <div style="font-size:0.73rem;color:var(--text-muted);font-family:var(--font-mono)">ID: ${e.id}</div>
        </div>

        <div class="tabs">
          ${[`details`,`tasks`,`delivery`].map(e=>S`
            <div class="tab ${this.activeTab===e?`active`:``}" @click=${()=>this.activeTab=e}>
              ${{details:`Details`,tasks:`Task History`,delivery:`Delivery`}[e]}
            </div>`)}
        </div>

        ${this.activeTab===`details`?this.renderJobDetails(e):``}
        ${this.activeTab===`tasks`?this.renderTaskHistory():``}
        ${this.activeTab===`delivery`?this.renderDeliveryConfig(e):``}

        <div class="btn-row" style="margin-top:0.5rem">
          <button class="btn btn-primary" style="flex:1" @click=${()=>this.runNow(e.id)}>⚡ Run Now</button>
          <button class="btn" @click=${()=>this.editJob(e)}>✏️ Edit</button>
          <button class="btn" @click=${()=>this.toggleEnabled(e)}>
            ${e.enabled?`⏸ Disable`:`▶ Enable`}
          </button>
          <button class="btn btn-danger" @click=${()=>this.deleteJob(e.id)}>✕</button>
        </div>
      </div>
    `}renderJobDetails(e){return S`
      <div style="display:flex;flex-direction:column;gap:0.6rem;font-size:0.85rem">
        <div><span style="color:var(--text-muted)">Agent:</span> <strong>${e.agentId}</strong></div>
        <div><span style="color:var(--text-muted)">Type:</span> <span class="badge badge-${e.type}">${e.type}</span></div>
        <div><span style="color:var(--text-muted)">Status:</span> <span class="badge ${this.getStatusBadgeClass(e)}">${this.getStatusLabel(e)}</span></div>
        <div><span style="color:var(--text-muted)">Schedule:</span> <code style="font-family:var(--font-mono);color:var(--accent-primary)">${e.schedule??e.expression}</code></div>
        <div><span style="color:var(--text-muted)">Timezone:</span> ${e.timezone}</div>
        ${e.humanSchedule?S`<div style="color:var(--text-muted);font-style:italic">${e.humanSchedule}</div>`:``}
        ${e.nextRun?S`
          <div style="background:var(--bg-tertiary);padding:0.5rem;border-radius:6px">
            ⏰ Next Run: <strong>${this.formatTs(e.nextRun)}</strong>
            <span style="color:var(--text-muted)">(${this.formatRelative(e.nextRun)})</span>
          </div>`:``}
        <div><span style="color:var(--text-muted)">Last Run:</span> ${this.formatTs(e.lastRun)}</div>

        ${e.consecutiveFailures>0?S`
          <div>
            <div style="color:var(--text-muted);margin-bottom:0.3rem">Backoff State (${e.consecutiveFailures} failures):</div>
            <div class="backoff-visual">
              ${[`30s`,`1m`,`5m`,`15m`,`60m`].map((t,n)=>{let r=e.consecutiveFailures;return S`<div class="backoff-step ${n<r-1?`done`:n===r-1?`current`:`pending`}">${t}</div>`})}
              <div class="backoff-step ${e.consecutiveFailures>=5?`done`:`pending`}" style="${e.consecutiveFailures>=5?`color:#ef4444`:``}">escalate</div>
            </div>
            ${e.backoffUntil?S`<div style="font-size:0.75rem;color:#f59e0b">Retrying ${this.formatRelative(e.backoffUntil)}</div>`:``}
          </div>`:``}

        <div style="background:var(--bg-primary);padding:0.6rem;border-radius:6px;margin-top:0.3rem">
          <div style="font-size:0.73rem;color:var(--text-muted);margin-bottom:0.2rem">Payload / Prompt:</div>
          <div style="font-size:0.82rem;font-style:italic;max-height:80px;overflow-y:auto">"${e.payload??e.prompt}"</div>
        </div>
      </div>
    `}renderTaskHistory(){return this.selectedJobTasks.length===0?S`<div style="text-align:center;color:var(--text-muted);padding:1.5rem;font-size:0.85rem">No task records found.</div>`:S`
      <div class="task-list">
        ${this.selectedJobTasks.map(e=>S`
          <div class="task-item ${e.status}">
            <div>
              <div style="font-weight:600">${new Date(e.startedAt).toLocaleString()}</div>
              <div style="color:var(--text-muted)">${e.isManualTrigger?`Manual trigger`:`Scheduled: ${this.formatTs(e.scheduledFireTime)}`}</div>
              <div class="task-drift ${e.driftMs>5e3?`high`:``}">Drift: ${e.driftMs}ms</div>
              ${e.output?S`<div style="font-size:0.7rem;color:var(--text-muted);margin-top:0.2rem;max-height:40px;overflow:hidden">${e.output.slice(0,120)}…</div>`:``}
              ${e.deliveryStatus===`skipped`?``:S`<div style="font-size:0.68rem;color:var(--text-muted)">Delivery: ${e.deliveryStatus} (${e.deliveryAttempts} attempt(s))</div>`}
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div>${{completed:`🟢`,failed:`🔴`,running:`🟡`,resumed:`🔵`,delivery_failed:`🟠`}[e.status]??`⚪`}</div>
              ${e.completedAt?S`<div style="font-size:0.68rem;color:var(--text-muted)">${e.completedAt-e.startedAt}ms</div>`:``}
              <div style="font-size:0.62rem;color:var(--text-muted);font-family:var(--font-mono)">${e.idempotencyKey}</div>
            </div>
          </div>
        `)}
      </div>
    `}renderDeliveryConfig(e){let t=`${this.getGatewayBaseUrl()}/api/cron/trigger/${e.id}`;return S`
      <div style="display:flex;flex-direction:column;gap:0.75rem;font-size:0.85rem">
        <div>Delivery Mode: <span class="badge badge-${e.deliveryMode}">${e.deliveryMode.toUpperCase()}</span></div>

        ${e.deliveryMode===`announce`?S`
          <div>Channel / Chat ID: <strong>${e.channel||`(auto-resolved from config)`}</strong></div>`:``}

        ${e.deliveryMode===`webhook`?S`
          <div>
            <div style="color:var(--text-muted);margin-bottom:0.25rem">Webhook URL:</div>
            <div class="mono" style="background:var(--bg-primary);padding:0.4rem;border-radius:4px">${e.webhookUrl||`Not configured`}</div>
          </div>`:``}

        <div class="webhook-box">
          <span style="font-size:0.78rem;font-weight:700;color:var(--accent-primary)">🔌 Manual Trigger Endpoint</span>
          <div class="mono" style="background:var(--bg-primary);padding:0.35rem;border-radius:4px">POST ${t}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.75rem">
            <span>Bearer Token: <code>${this.revealWebhookToken?e.webhookToken:`•`.repeat(16)}</code></span>
            <button class="btn btn-sm" @click=${()=>this.revealWebhookToken=!this.revealWebhookToken}>
              ${this.revealWebhookToken?`Hide`:`Reveal`}
            </button>
          </div>
          <button class="btn" style="width:100%;font-size:0.75rem" @click=${()=>{navigator.clipboard.writeText(t),alert(`URL copied!\nToken: ${e.webhookToken}`)}}>📋 Copy URL</button>
        </div>
      </div>
    `}renderForm(){return S`
      <div style="display:flex;flex-direction:column;gap:0.25rem;height:100%">
        <h3 style="font-family:var(--font-display);border-bottom:1px solid var(--border-color);padding-bottom:0.5rem;margin-bottom:0.5rem">
          ${this.selectedJob?`✏️ Edit Job`:`➕ Create Job`}
        </h3>

        <div class="form-group">
          <label>Job Name</label>
          <input type="text" placeholder="e.g. Daily Briefing" .value=${this.formName}
            @input=${e=>this.formName=e.target.value} />
        </div>

        <div class="form-group">
          <label>Target Agent</label>
          <select .value=${this.formAgentId} @change=${e=>this.formAgentId=e.target.value}>
            ${this.agents.map(e=>S`<option value=${e.id}>${e.name??e.id}</option>`)}
          </select>
        </div>

        <div class="form-group">
          <label>Schedule (cron expression or ISO timestamp)</label>
          <input type="text" class="${this.scheduleValid?``:`invalid`}"
            placeholder="0 9 * * * (daily at 9am)" .value=${this.formSchedule}
            style="font-family:var(--font-mono)"
            @input=${e=>this.validateSchedule(e.target.value)} />
          ${this.schedulePreview?S`
            <div class="schedule-preview ${this.scheduleValid?`valid`:`invalid`}">
              ${this.scheduleValid?`📅 `:`❌ `}${this.schedulePreview}
            </div>`:``}
        </div>

        <div class="form-group">
          <label>Timezone</label>
          <select .value=${this.formTimezone} @change=${e=>{this.formTimezone=e.target.value,this.validateSchedule(this.formSchedule)}}>
            ${Ve.map(e=>S`<option value=${e}>${e}</option>`)}
          </select>
        </div>

        <div class="form-group">
          <label>Execution Type</label>
          <div class="type-grid">
            ${[`session`,`isolated`,`command`].map(e=>S`
              <div class="type-btn ${this.formType===e?`selected`:``}" @click=${()=>this.formType=e}>
                ${{session:`🧠 Session`,isolated:`🔒 Isolated`,command:`🖥 Command`}[e]}
              </div>`)}
          </div>
          <span style="font-size:0.72rem;color:var(--text-muted)">
            ${{session:`Full session context — good for daily briefings, reviews`,isolated:`Fresh context per run — good for one-off reports, checks`,command:`Runs shell command directly — no agent loop`}[this.formType]}
          </span>
        </div>

        <div class="form-group">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <label>${this.formType===`command`?`Shell Command`:`Agent Prompt`}</label>
            ${this.formType===`command`?``:S`
              <button class="btn btn-sm" ?disabled=${this.isGeneratingPrompt} @click=${this.generatePayloadWithAI}>
                ${this.isGeneratingPrompt?`⏳ Generating…`:`✨ AI Generate`}
              </button>`}
          </div>
          <textarea placeholder="${this.formType===`command`?`e.g. /usr/bin/df -h`:`Write the instructions the agent should execute…`}"
            .value=${this.formPayload}
            @input=${e=>this.formPayload=e.target.value}></textarea>
        </div>

        ${this.formType===`command`?``:S`
          <div class="form-group" style="flex-direction:row;align-items:center;gap:0.5rem">
            <input type="checkbox" id="dynpay" .checked=${this.formDynamicPayload} style="width:auto"
              @change=${e=>this.formDynamicPayload=e.target.checked} />
            <label for="dynpay">Generate prompt dynamically at runtime using agent AI</label>
          </div>`}

        <div class="form-group">
          <label>Delivery Mode</label>
          <div class="delivery-grid">
            ${[`announce`,`webhook`,`none`].map(e=>S`
              <div class="delivery-btn ${this.formDeliveryMode===e?`selected`:``}" @click=${()=>this.formDeliveryMode=e}>
                ${{announce:`📣 Announce`,webhook:`🔗 Webhook`,none:`🔇 Silent`}[e]}
              </div>`)}
          </div>
        </div>

        ${this.formDeliveryMode===`announce`?S`
          <div class="form-group">
            <label>Chat ID / Channel (optional — auto-detected if blank)</label>
            <input type="text" placeholder="e.g. -1001234567890" .value=${this.formChannel}
              @input=${e=>this.formChannel=e.target.value} />
          </div>`:``}

        ${this.formDeliveryMode===`webhook`?S`
          <div class="form-group">
            <label>Webhook URL</label>
            <input type="url" placeholder="https://your-service.example.com/hook" .value=${this.formWebhookUrl}
              @input=${e=>this.formWebhookUrl=e.target.value} />
          </div>`:``}

        <div class="form-group" style="flex-direction:row;align-items:center;gap:0.5rem">
          <input type="checkbox" id="enabled" .checked=${this.formEnabled} style="width:auto"
            @change=${e=>this.formEnabled=e.target.checked} />
          <label for="enabled">Enable job immediately on save</label>
        </div>

        <div style="display:flex;gap:0.5rem;margin-top:auto;padding-top:0.75rem">
          <button class="btn btn-primary" style="flex:1" @click=${this.saveJob}>💾 Save</button>
          <button class="btn" @click=${()=>this.isEditing=!1}>Cancel</button>
        </div>
      </div>
    `}};e([A()],R.prototype,`jobs`,void 0),e([A()],R.prototype,`selectedJob`,void 0),e([A()],R.prototype,`selectedJobTasks`,void 0),e([A()],R.prototype,`isEditing`,void 0),e([A()],R.prototype,`agents`,void 0),e([A()],R.prototype,`liveNotification`,void 0),e([A()],R.prototype,`isGeneratingPrompt`,void 0),e([A()],R.prototype,`revealWebhookToken`,void 0),e([A()],R.prototype,`driftReport`,void 0),e([A()],R.prototype,`boundaryWarnings`,void 0),e([A()],R.prototype,`schedulePreview`,void 0),e([A()],R.prototype,`scheduleValid`,void 0),e([A()],R.prototype,`activeTab`,void 0),e([A()],R.prototype,`formId`,void 0),e([A()],R.prototype,`formName`,void 0),e([A()],R.prototype,`formAgentId`,void 0),e([A()],R.prototype,`formSchedule`,void 0),e([A()],R.prototype,`formTimezone`,void 0),e([A()],R.prototype,`formType`,void 0),e([A()],R.prototype,`formPayload`,void 0),e([A()],R.prototype,`formDynamicPayload`,void 0),e([A()],R.prototype,`formDeliveryMode`,void 0),e([A()],R.prototype,`formChannel`,void 0),e([A()],R.prototype,`formWebhookUrl`,void 0),e([A()],R.prototype,`formWebhookToken`,void 0),e([A()],R.prototype,`formEnabled`,void 0),R=e([k(`cron-page`)],R);var z=class extends O{constructor(...e){super(...e),this.activeAgent=``,this.activeSession=``,this.messages=[],this.inputMessage=``,this.isGenerating=!1,this.activeModel=``,this.chatSearchQuery=``,this.pinnedMessages=[],this.agents=[],this.models=[],this.chatMode=`agent`,this.activeTeam=``,this.teams=[],this.activeTeamNodeAnimation={},this.streamingText=``,this.currentPlan=null,this.reasoningSetting=`off`,this.wsClient=j.getInstance()}static{this.styles=s`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      height: calc(100vh - 190px);
      overflow: hidden;
    }

    .chat-layout {
      display: flex;
      gap: 1rem;
      flex: 1;
      height: 100%;
      overflow: hidden;
    }

    .chat-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      overflow: hidden;
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(12px);
    }

    .chat-sidebar {
      width: 260px;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      overflow-y: auto;
      backdrop-filter: blur(12px);
    }

    /* Top Control Bar */
    .control-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      background-color: var(--bg-tertiary);
      border-bottom: 1px solid var(--border-color);
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .controls-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .controls-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    /* Custom Switch button group */
    .mode-switch-group {
      display: flex;
      background: var(--bg-primary);
      padding: 0.2rem;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      gap: 0.15rem;
    }

    .switch-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      padding: 0.35rem 0.75rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 600;
      transition: all 0.2s ease;
    }

    .switch-btn.active {
      background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
      color: white;
      box-shadow: 0 2px 10px rgba(167, 139, 250, 0.25);
    }

    select, input {
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      padding: 0.4rem 0.6rem;
      outline: none;
      font-size: 0.85rem;
      transition: all 0.2s;
    }

    select:focus, input:focus {
      border-color: var(--accent-secondary);
    }

    /* Radial Team Visualizer in main layout */
    .team-visualizer-panel {
      background: rgba(0, 0, 0, 0.15);
      border-bottom: 1px solid var(--border-color);
      padding: 0.75rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
    }

    .team-visualizer-header {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--accent-secondary);
      margin-bottom: 0.25rem;
      align-self: flex-start;
    }

    .visualizer-svg {
      width: 100%;
      height: 110px;
      max-width: 600px;
    }

    /* Messages Area */
    .messages-area {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      background-color: var(--bg-primary);
    }

    /* Scrollbar Styling */
    .messages-area::-webkit-scrollbar, .chat-sidebar::-webkit-scrollbar {
      width: 6px;
    }
    .messages-area::-webkit-scrollbar-track, .chat-sidebar::-webkit-scrollbar-track {
      background: transparent;
    }
    .messages-area::-webkit-scrollbar-thumb, .chat-sidebar::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
    }
    .messages-area::-webkit-scrollbar-thumb:hover, .chat-sidebar::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .msg-bubble-container {
      display: flex;
      flex-direction: column;
      max-width: 80%;
      position: relative;
    }

    .msg-bubble-container.user {
      align-self: flex-end;
    }

    .msg-bubble-container.model {
      align-self: flex-start;
    }

    .msg-bubble-container.system {
      align-self: center;
      max-width: 90%;
      text-align: center;
      font-style: italic;
      opacity: 0.85;
    }

    .msg-bubble-container.collab {
      align-self: center;
      max-width: 85%;
      width: 100%;
      animation: fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .msg-bubble {
      padding: 0.85rem 1.1rem;
      border-radius: var(--border-radius);
      font-size: 0.95rem;
      line-height: 1.5;
      position: relative;
      word-break: break-word;
    }

    .user .msg-bubble {
      background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
      color: white;
      border-bottom-right-radius: 2px;
      box-shadow: 0 4px 15px rgba(167, 139, 250, 0.2);
    }

    .model .msg-bubble {
      background-color: var(--bg-secondary);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      border-bottom-left-radius: 2px;
    }

    .system .msg-bubble {
      background-color: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      font-size: 0.85rem;
    }

    /* Collaboration Bubble card */
    .collab .msg-bubble {
      background: rgba(255, 255, 255, 0.02);
      border: 1px dashed rgba(167, 139, 250, 0.35);
      border-radius: 12px;
      color: var(--text-primary);
      padding: 1rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      backdrop-filter: blur(8px);
    }

    .collab-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.75rem;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-bottom: 0.5rem;
      padding-bottom: 0.35rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .agent-tag {
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      font-family: var(--font-mono);
      font-weight: bold;
    }

    .agent-tag.sender {
      background: rgba(167, 139, 250, 0.15);
      color: #c084fc;
      border: 1px solid rgba(167, 139, 250, 0.3);
    }

    .agent-tag.receiver {
      background: rgba(0, 240, 255, 0.1);
      color: #22d3ee;
      border: 1px solid rgba(0, 240, 255, 0.2);
    }

    .arrow-icon {
      color: var(--text-muted);
      font-weight: bold;
    }

    .msg-meta {
      font-size: 0.7rem;
      color: var(--text-muted);
      margin-top: 0.25rem;
      display: flex;
      gap: 0.5rem;
      align-self: flex-end;
    }

    .user .msg-meta {
      align-self: flex-end;
      color: rgba(255, 255, 255, 0.6);
    }

    .pin-btn {
      cursor: pointer;
      opacity: 0.3;
      transition: opacity 0.2s;
      background: none;
      border: none;
      color: var(--text-primary);
      font-size: 0.8rem;
    }

    .msg-bubble-container:hover .pin-btn, .pin-btn.pinned {
      opacity: 1;
    }

    /* Plan Panel */
    .plan-panel {
      background: rgba(30, 41, 59, 0.4);
      border: 1px solid rgba(59, 130, 246, 0.2);
      border-radius: 12px;
      padding: 1rem;
      margin: 1rem 1.5rem 0 1.5rem;
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
      animation: fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .plan-header {
      font-weight: 700;
      color: #fff;
      font-size: 0.95rem;
      margin-bottom: 0.5rem;
    }
    .plan-steps {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .plan-step {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
    }
    .plan-step.completed {
      color: #10b981;
    }
    .plan-step.running {
      color: #f59e0b;
      font-weight: bold;
    }
    .plan-step.failed {
      color: #ef4444;
    }
    .step-verify {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-left: auto;
    }

    /* Input Footer */
    .input-footer {
      padding: 1rem;
      background-color: var(--bg-tertiary);
      border-top: 1px solid var(--border-color);
      display: flex;
      gap: 0.75rem;
      align-items: center;
    }

    .chat-input {
      flex: 1;
      padding: 0.75rem 1rem;
      font-size: 0.95rem;
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
    }

    .btn {
      background-color: var(--accent-primary);
      border: 1px solid var(--accent-primary);
      color: var(--text-primary);
      padding: 0.7rem 1.2rem;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .btn:hover {
      opacity: 0.9;
    }

    .btn-abort {
      background-color: var(--status-red-glow);
      color: var(--status-red);
      border-color: rgba(255, 51, 102, 0.3);
    }

    .btn-abort:hover {
      background-color: var(--status-red);
      color: white;
    }

    .pinned-item {
      padding: 0.5rem;
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      font-size: 0.8rem;
      position: relative;
    }

    /* Graph Visualizer nodes */
    .node-circle {
      fill: var(--bg-tertiary);
      stroke: var(--border-color);
      stroke-width: 2px;
      transition: all 0.3s;
    }

    .node-circle.active {
      stroke: var(--accent-secondary);
      fill: rgba(0, 240, 255, 0.1);
      filter: drop-shadow(0px 0px 4px var(--accent-secondary));
    }

    .node-circle.leader {
      stroke: var(--accent-primary);
      fill: rgba(167, 139, 250, 0.1);
      filter: drop-shadow(0px 0px 4px var(--accent-primary));
    }

    .link-line {
      fill: none;
      stroke: var(--border-color);
      stroke-dasharray: 2 2;
    }

    .particle {
      fill: var(--accent-secondary);
      filter: drop-shadow(0px 0px 3px var(--accent-secondary));
    }

    .text-name {
      font-weight: bold;
      fill: var(--text-primary);
      text-anchor: middle;
      font-family: var(--font-mono);
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes pulse {
      0% { transform: scale(0.95); opacity: 0.5; }
      50% { transform: scale(1.1); opacity: 1; }
      100% { transform: scale(0.95); opacity: 0.5; }
    }
  `}connectedCallback(){super.connectedCallback(),this.loadConfig().then(()=>{this.startNewSession()}),this.wsClient.addEventListener(this.handleBusMessage.bind(this))}disconnectedCallback(){super.disconnectedCallback(),this.wsClient.removeEventListener(this.handleBusMessage.bind(this))}async loadConfig(){let e=this.wsClient.getToken();try{let t=await fetch(`${this.wsClient.getGatewayUrl()}/api/config`,{method:`GET`,headers:{Authorization:`Bearer ${e}`}});if(t.ok){let e=(await t.json()).config;this.agents=e.agents||[],this.teams=e.teams||[];let n=[];if(e.models&&e.models.providers){let t=e.models.providers;for(let[e,r]of Object.entries(t)){let t=r.models||[];for(let r of t){let t=typeof r==`string`?r:r.id;n.find(n=>n.id===t&&n.provider===e)||n.push({id:t,name:typeof r==`string`?r:r.name||r.id,provider:e})}}}e.models&&Array.isArray(e.models)&&e.models.forEach(e=>{if(e&&e.id){let t=e.provider||`gemini`;n.find(n=>n.id===e.id&&n.provider===t)||n.push({id:e.id,name:e.name||e.id,provider:t})}}),this.models=n,this.agents.length===0&&(this.agents=[]),this.models.length===0&&(this.models=[{id:`gemini-1.5-flash`,name:`Gemini 1.5 Flash`,provider:`gemini`}]),this.agents.length>0&&!this.activeAgent&&(this.activeAgent=this.agents[0].id),this.teams.length>0&&!this.activeTeam&&(this.activeTeam=this.teams[0].id),this.models.length>0&&!this.activeModel&&(this.activeModel=this.models[0].id)}}catch(e){console.error(`[ChatPage] Failed to load config options:`,e)}}startNewSession(){if(this.messages=[],this.streamingText=``,this.currentPlan=null,this.isGenerating=!1,this.activeTeamNodeAnimation={},this.chatMode===`agent`){if(!this.activeAgent)return;this.activeSession=`${this.activeAgent}:chat:web_${Date.now()}`}else{if(!this.activeTeam)return;let e=this.teams.find(e=>e.id===this.activeTeam),t=e?.leaderAgentId||e?.memberAgentIds[0]||``;if(!t){alert(`Selected team has no agents.`);return}this.activeSession=`${t}:chat:team_${this.activeTeam}_${Date.now()}`}this.wsClient.send(`setReasoningSetting`,{sessionId:this.activeSession,value:this.reasoningSetting}).catch(()=>{})}handleBusMessage(e,t){if(e===`busMessage`){let e=t.topic,n=t.message;if(e===`loop_progress`&&n.sessionId===this.activeSession){let e=n.event;e&&e.type===`thinking_stream`&&e.chunk?(this.streamingText+=e.chunk,this.isGenerating=!0,this.requestUpdate(),this.scrollToBottom()):e&&e.type===`plan_progress`&&(this.currentPlan=e.plan,this.requestUpdate())}if(e===`agent_message`&&n.sessionId===this.activeSession&&(this.isGenerating=!1,this.streamingText=``,this.messages.some(e=>e.role===`model`&&e.content===n.content&&e.timestamp===n.timestamp)||(this.messages=[...this.messages,{id:crypto.randomUUID(),role:`model`,content:n.content,timestamp:n.timestamp||Date.now()}],this.requestUpdate(),this.scrollToBottom())),this.chatMode===`team`&&e.startsWith(`agent:`)){let t=e.split(`:`)[1],r=n.from,i=this.teams.find(e=>e.id===this.activeTeam);if(i){let e=[...i.memberAgentIds];i.leaderAgentId&&!e.includes(i.leaderAgentId)&&e.push(i.leaderAgentId),e.includes(r)&&e.includes(t)&&(this.messages.some(e=>e.role===`collab`&&e.from===r&&e.to===t&&e.content===n.content)||(this.messages=[...this.messages,{id:crypto.randomUUID(),role:`collab`,from:r,to:t,content:n.content,timestamp:n.timestamp||Date.now()}],this.triggerCollaborationAnimation(r,t,e),this.requestUpdate(),this.scrollToBottom()))}}}}triggerCollaborationAnimation(e,t,n){let r=n.length,i=n.indexOf(this.teams.find(e=>e.id===this.activeTeam)?.leaderAgentId||``),a=e=>{let t=n.indexOf(e);if(t===-1||t===i&&i!==-1)return{x:300,y:55};let a=t*2*Math.PI/(r-1||1)-Math.PI/2;return{x:300+38*Math.cos(a),y:55+38*Math.sin(a)}},o=a(e),s=a(t);this.activeTeamNodeAnimation={senderId:e,receiverId:t,senderX:o.x,senderY:o.y,receiverX:s.x,receiverY:s.y},setTimeout(()=>{this.activeTeamNodeAnimation.senderId===e&&this.activeTeamNodeAnimation.receiverId===t&&(this.activeTeamNodeAnimation={})},1e3)}switchMode(e){this.chatMode=e,this.startNewSession()}scrollToBottom(){let e=this.shadowRoot?.querySelector(`.messages-area`);e&&setTimeout(()=>{e.scrollTop=e.scrollHeight},50)}async sendMessage(){if(!this.inputMessage.trim()||this.isGenerating)return;let e=this.inputMessage;this.inputMessage=``;let t={id:crypto.randomUUID(),role:`user`,content:e,timestamp:Date.now()};this.messages=[...this.messages,t],this.isGenerating=!0;let n=this.activeAgent;if(this.chatMode===`team`){let e=this.teams.find(e=>e.id===this.activeTeam);n=e?.leaderAgentId||e?.memberAgentIds[0]||``}try{await this.wsClient.send(`sendMessageToAgent`,{agentId:n,sessionId:this.activeSession,text:e})}catch(e){alert(`Message dispatch failed: ${e.message}`),this.isGenerating=!1}}async abortGeneration(){if(this.isGenerating)try{await this.wsClient.send(`stopAgent`,{sessionId:this.activeSession}),this.isGenerating=!1,this.streamingText=``,this.messages=[...this.messages,{id:crypto.randomUUID(),role:`system`,content:`❌ Generation Aborted by Host Operator.`,timestamp:Date.now()}]}catch(e){alert(`Abort command failed: ${e.message}`)}}togglePin(e){e.pinned=!e.pinned,e.pinned?this.pinnedMessages=[...this.pinnedMessages,e]:this.pinnedMessages=this.pinnedMessages.filter(t=>t.id!==e.id),this.requestUpdate()}exportChat(e){let t=``;if(e===`json`)t=JSON.stringify(this.messages,null,2);else{t=`# Chat Transcript: ${this.activeSession}\n\n`;for(let e of this.messages)e.role===`collab`?t+=`### **COLLABORATION** _(${new Date(e.timestamp).toLocaleTimeString()})_\nFrom: **${e.from}** ➔ To: **${e.to}**\n${e.content}\n\n`:t+=`### **${e.role.toUpperCase()}** _(${new Date(e.timestamp).toLocaleTimeString()})_\n${e.content}\n\n`}let n=new Blob([t],{type:`text/plain;charset=utf-8`}),r=URL.createObjectURL(n),i=document.createElement(`a`);i.href=r,i.download=`komorebi_chat_${this.activeSession}.${e===`json`?`json`:`md`}`,i.click(),URL.revokeObjectURL(r)}getAgentName(e){let t=this.agents.find(t=>t.id===e);return t?t.name:e}render(){let e=this.messages.filter(e=>!this.chatSearchQuery||e.content.toLowerCase().includes(this.chatSearchQuery.toLowerCase())),t=this.chatMode===`team`?this.teams.find(e=>e.id===this.activeTeam):null,n=t?[...t.memberAgentIds]:[];t?.leaderAgentId&&!n.includes(t.leaderAgentId)&&n.push(t.leaderAgentId);let r=n.map((e,r)=>{let i=e===t?.leaderAgentId;if(i)return{id:e,name:this.getAgentName(e),x:300,y:55,isLeader:i};let a=r*2*Math.PI/(n.length-1||1)-Math.PI/2;return{id:e,name:this.getAgentName(e),x:300+38*Math.cos(a),y:55+38*Math.sin(a),isLeader:!1}});return S`
      <div class="chat-layout">
        <!-- Main Panel -->
        <div class="chat-main">
          <!-- Top Control Bar -->
          <div class="control-bar">
            <div class="controls-left">
              <!-- Mode Switch -->
              <div class="mode-switch-group">
                <button class="switch-btn ${this.chatMode===`agent`?`active`:``}" @click=${()=>this.switchMode(`agent`)}>
                  🤖 Single Agent
                </button>
                <button class="switch-btn ${this.chatMode===`team`?`active`:``}" @click=${()=>this.switchMode(`team`)}>
                  👥 Agent Team
                </button>
              </div>

              <!-- Selection Dropdowns based on Mode -->
              ${this.chatMode===`agent`?S`
                <select .value=${this.activeAgent} @change=${e=>{this.activeAgent=e.target.value,this.startNewSession()}}>
                  ${this.agents.map(e=>S`
                    <option value=${e.id}>${e.name||e.id}</option>
                  `)}
                </select>
              `:S`
                <select .value=${this.activeTeam} @change=${e=>{this.activeTeam=e.target.value,this.startNewSession()}}>
                  ${this.teams.map(e=>S`
                    <option value=${e.id}>${e.name}</option>
                  `)}
                </select>
              `}

              <select .value=${this.activeModel} @change=${e=>this.activeModel=e.target.value}>
                ${this.models.map(e=>S`
                  <option value=${e.id}>${e.name} (${e.provider})</option>
                `)}
              </select>

              <select .value=${this.reasoningSetting} @change=${async e=>{this.reasoningSetting=e.target.value,await this.wsClient.send(`setReasoningSetting`,{sessionId:this.activeSession,value:this.reasoningSetting})}}>
                <option value="off">Reasoning: Hidden</option>
                <option value="on">Reasoning: Visible</option>
                <option value="stream">Reasoning: Streamed</option>
              </select>
            </div>

            <div class="controls-right">
              <input 
                type="text" 
                placeholder="Search history..." 
                .value=${this.chatSearchQuery}
                @input=${e=>this.chatSearchQuery=e.target.value}
                style="padding: 0.3rem; font-size: 0.8rem; width: 140px;"
              />
              <button class="btn" style="padding: 0.35rem 0.6rem; font-size: 0.8rem" @click=${this.startNewSession}>
                🧹 Reset
              </button>
            </div>
          </div>

          <!-- Team visualizer node chart inside chat container -->
          ${this.chatMode===`team`&&t?S`
            <div class="team-visualizer-panel">
              <div class="team-visualizer-header">👥 Team Collaboration Live Stream</div>
              <svg class="visualizer-svg" viewBox="240 10 120 90">
                <!-- Connect Radial nodes to center leader -->
                ${r.filter(e=>!e.isLeader).map(e=>S`
                  <line 
                    class="link-line"
                    x1=${e.x} y1=${e.y}
                    x2=${300} y2=${55}
                    style="stroke: rgba(255,255,255,0.06); stroke-width: 1px;"
                  />
                `)}

                <!-- Traveling packet particle flow -->
                ${this.activeTeamNodeAnimation.senderX===void 0?``:S`
                  <path 
                    id="flow-path-anim"
                    class="link-line"
                    d="M ${this.activeTeamNodeAnimation.senderX} ${this.activeTeamNodeAnimation.senderY} L ${this.activeTeamNodeAnimation.receiverX} ${this.activeTeamNodeAnimation.receiverY}"
                    style="stroke: var(--accent-secondary); stroke-width: 1.5px; opacity: 0.8;"
                  />
                  <circle class="particle" r="2.5">
                    <animateMotion dur="0.6s" repeatCount="1" fill="remove">
                      <mpath href="#flow-path-anim" />
                    </animateMotion>
                  </circle>
                `}

                <!-- Radial Nodes -->
                ${r.map(e=>{let t=this.activeTeamNodeAnimation.senderId===e.id||this.activeTeamNodeAnimation.receiverId===e.id;return S`
                    <g transform="translate(${e.x}, ${e.y})">
                      <circle 
                        class="node-circle ${e.isLeader?`leader`:``} ${t?`active`:``}" 
                        r=${e.isLeader?8:6}
                      />
                      <text class="text-name" y="14" style="font-size: 3.5px;">${e.name.split(` `)[0].toUpperCase()}</text>
                    </g>
                  `})}
              </svg>
            </div>
          `:``}

          ${this.currentPlan?S`
            <div class="plan-panel">
              <div class="plan-header">📋 Task Plan: ${this.currentPlan.goal}</div>
              <div class="plan-steps">
                ${this.currentPlan.subtasks.map(e=>{let t=e.status===`completed`?`✅`:e.status===`running`?`⏳`:e.status===`failed`?`❌`:`◽`;return S`
                    <div class="plan-step ${e.status}">
                      <span class="step-marker">${t}</span>
                      <span class="step-desc">${e.description}</span>
                      <span class="step-verify">(${e.successCondition})</span>
                    </div>
                  `})}
              </div>
            </div>
          `:``}

          <!-- Messages Area -->
          <div class="messages-area">
            ${e.length===0&&!this.streamingText&&!this.isGenerating?S`
              <div style="text-align: center; color: var(--text-muted); margin: auto; max-width: 380px; font-size: 0.9rem">
                👋 Send a task instruction to begin. 
                ${this.chatMode===`team`?S`
                  The <strong>Team Leader</strong> will ingest the instruction and coordinate with other members of the <strong>${t?.name||``}</strong> team using event bus message topics. All agent discussions will render below live.
                `:S`
                  The agent will execute its ReAct loop, call tools, write files, and output replies.
                `}
              </div>
            `:e.map(e=>e.role===`collab`?S`
                  <div class="msg-bubble-container collab">
                    <div class="msg-bubble">
                      <div class="collab-header">
                        <span class="agent-tag sender">${e.from}</span>
                        <span class="arrow-icon">➔</span>
                        <span class="agent-tag receiver">${e.to}</span>
                      </div>
                      <div style="font-size: 0.9rem; line-height: 1.45; white-space: pre-wrap;">${e.content}</div>
                    </div>
                    <div class="msg-meta">
                      <span>${new Date(e.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                `:S`
                <div class="msg-bubble-container ${e.role}">
                  <div class="msg-bubble">
                    <div style="white-space: pre-wrap;">${e.content}</div>
                  </div>
                  <div class="msg-meta">
                    <span>${new Date(e.timestamp).toLocaleTimeString()}</span>
                    <button class="pin-btn ${e.pinned?`pinned`:``}" @click=${()=>this.togglePin(e)}>
                      ${e.pinned?`📌 Pinned`:`📌`}
                    </button>
                  </div>
                </div>
              `)}

            <!-- Live Streaming Text simulated response -->
            ${this.streamingText?S`
              <div class="msg-bubble-container model">
                <div class="msg-bubble" style="white-space: pre-wrap;">${this.streamingText}<span style="display:inline-block; width:8px; height:15px; background:var(--text-primary); animation:pulse 0.8s infinite; margin-left:2px"></span></div>
              </div>
            `:``}

            <!-- Thinking loop animations -->
            ${this.isGenerating&&!this.streamingText?S`
              <div class="msg-bubble-container model">
                <div class="msg-bubble" style="display: flex; align-items: center; gap: 0.5rem">
                  <div style="width: 10px; height: 10px; border-radius: 50%; background: var(--accent-secondary); animation: pulse 1s infinite"></div>
                  <span style="font-size: 0.85rem; color: var(--text-secondary); font-style: italic">Agent processing ReAct loop & invoking tools...</span>
                </div>
              </div>
            `:``}
          </div>

          <!-- Input Footer -->
          <div class="input-footer">
            <input 
              type="text" 
              class="chat-input" 
              placeholder=${this.chatMode===`team`?`Instruct the agent team to collaborate and solve the task...`:`Ask the agent to perform analysis, run scripts, compile plans...`}
              .value=${this.inputMessage}
              @input=${e=>this.inputMessage=e.target.value}
              @keydown=${e=>e.key===`Enter`&&this.sendMessage()}
            />
            
            ${this.isGenerating?S`
              <button class="btn btn-abort" @click=${this.abortGeneration}>🛑 Abort</button>
            `:S`
              <button class="btn" @click=${this.sendMessage}>🚀 Send</button>
            `}
          </div>
        </div>

        <!-- Pinned Messages Sidebar -->
        <div class="chat-sidebar">
          <div style="font-weight: 600; font-family: var(--font-display); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem">
            📌 Pinned Messages
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.5rem; flex: 1">
            ${this.pinnedMessages.length===0?S`
              <div style="font-size: 0.75rem; color: var(--text-muted); text-align: center; margin-top: 1rem">
                No pinned messages. Hover chat messages to pin.
              </div>
            `:this.pinnedMessages.map(e=>S`
              <div class="pinned-item">
                <div style="font-weight: 600; font-size: 0.7rem; color: var(--accent-secondary); margin-bottom: 0.2rem">
                  ${e.role.toUpperCase()}
                </div>
                <div style="font-size: 0.75rem; text-overflow: ellipsis; overflow: hidden; max-height: 50px; line-height: 1.3">
                  ${e.content}
                </div>
              </div>
            `)}
          </div>
          
          <div style="border-top: 1px solid var(--border-color); padding-top: 0.75rem; display: flex; flex-direction: column; gap: 0.4rem">
            <button class="btn" style="font-size: 0.8rem; padding: 0.4rem; background: var(--bg-tertiary)" @click=${()=>this.exportChat(`md`)}>
              Export Markdown
            </button>
            <button class="btn" style="font-size: 0.8rem; padding: 0.4rem; background: var(--bg-tertiary)" @click=${()=>this.exportChat(`json`)}>
              Export JSON
            </button>
          </div>
        </div>
      </div>
    `}};e([A()],z.prototype,`activeAgent`,void 0),e([A()],z.prototype,`activeSession`,void 0),e([A()],z.prototype,`messages`,void 0),e([A()],z.prototype,`inputMessage`,void 0),e([A()],z.prototype,`isGenerating`,void 0),e([A()],z.prototype,`activeModel`,void 0),e([A()],z.prototype,`chatSearchQuery`,void 0),e([A()],z.prototype,`pinnedMessages`,void 0),e([A()],z.prototype,`agents`,void 0),e([A()],z.prototype,`models`,void 0),e([A()],z.prototype,`chatMode`,void 0),e([A()],z.prototype,`activeTeam`,void 0),e([A()],z.prototype,`teams`,void 0),e([A()],z.prototype,`activeTeamNodeAnimation`,void 0),e([A()],z.prototype,`streamingText`,void 0),e([A()],z.prototype,`currentPlan`,void 0),e([A()],z.prototype,`reasoningSetting`,void 0),z=e([k(`chat-page`)],z);var B=class extends O{constructor(...e){super(...e),this.config=null,this.baseHash=``,this.selectedAgentId=``,this.envKeys={},this.currentTab=`capabilities`,this.filterType=`all`,this.installedSkills=[],this.installedPlugins=[],this.learnedSkills=[],this.isInstalledLoading=!1,this.skillsHealth={},this.expandedFindings={},this.searchQuery=``,this.searchResults=[],this.isSearching=!1,this.licenses=[],this.isInstallModalOpen=!1,this.selectedSkill=null,this.targetAgentId=`global`,this.installStatus=``,this.isInstalling=!1,this.securityResult=null,this.wsClient=j.getInstance(),this.availableTools=[{name:`read_file`,desc:`Allows agent to view file contents recursively.`,category:`File Systems`},{name:`write_file`,desc:`Allows agent to create and overwrite project files.`,category:`File Systems`},{name:`edit_file`,desc:`Performs targeted, inline edits of lines in place.`,category:`File Systems`},{name:`exec`,desc:`Runs CLI commands inside sandbox workspace shell.`,category:`Shell Operations`},{name:`web_search`,desc:`Performs search engine crawls for data lookups.`,category:`Web Services`},{name:`web_fetch`,desc:`Fetches and converts webpage HTML content to markdown.`,category:`Web Services`},{name:`telegram_reply`,desc:`Dispatches outbound messages back to Telegram channels.`,category:`Integrations`}]}static{this.styles=s`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .title {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .tab-bar {
      display: flex;
      border-bottom: 1px solid var(--border-color);
      gap: 1rem;
    }

    .tab-item {
      background: none;
      border: none;
      color: var(--text-muted);
      padding: 0.5rem 1rem;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
    }

    .tab-item:hover {
      color: var(--text-primary);
    }

    .tab-item.active {
      color: var(--accent-secondary);
      border-bottom-color: var(--accent-secondary);
    }

    .layout {
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: 1.5rem;
    }

    .panel {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .panel-header {
      font-family: var(--font-display);
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-primary);
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Capabilities list styles */
    .skills-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }

    .skill-card {
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      transition: border-color 0.2s;
    }

    .skill-card:hover {
      border-color: var(--accent-primary);
    }

    .skill-checkbox {
      width: auto;
      margin-top: 0.2rem;
      cursor: pointer;
    }

    .skill-info {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .skill-name {
      font-weight: 600;
      font-family: var(--font-mono);
      font-size: 0.9rem;
      color: var(--text-primary);
    }

    .skill-desc {
      font-size: 0.8rem;
      color: var(--text-secondary);
      line-height: 1.3;
    }

    .skill-category {
      font-size: 0.7rem;
      background: var(--bg-primary);
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
      color: var(--accent-secondary);
      border: 1px solid var(--border-color);
      align-self: flex-start;
    }

    .env-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-secondary);
    }

    input, select {
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      padding: 0.5rem 0.6rem;
      outline: none;
      font-size: 0.9rem;
    }

    .btn {
      background-color: var(--accent-primary);
      border: 1px solid var(--accent-primary);
      color: var(--text-primary);
      padding: 0.6rem 1.2rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
    }

    .btn:hover {
      opacity: 0.9;
    }

    .btn-secondary {
      background-color: var(--bg-tertiary);
      border-color: var(--border-color);
    }

    .btn-secondary:hover {
      background-color: var(--border-color);
    }

    /* ClawHub Browse Grid */
    .clawhub-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }

    .ch-card {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
    }

    .ch-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .ch-name {
      font-family: var(--font-display);
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .ch-slug {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .ch-desc {
      font-size: 0.8rem;
      color: var(--text-secondary);
      line-height: 1.4;
      flex: 1;
    }

    .ch-meta {
      font-size: 0.75rem;
      color: var(--text-muted);
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      border-top: 1px dashed var(--border-color);
      padding-top: 0.5rem;
    }

    .badge {
      font-size: 0.65rem;
      font-weight: 600;
      padding: 0.1rem 0.3rem;
      border-radius: 4px;
    }

    .badge.verified {
      background-color: var(--status-green-glow);
      color: var(--status-green);
    }

    .badge.unverified {
      background-color: var(--status-yellow-glow);
      color: var(--status-yellow);
    }

    .badge.price {
      background-color: rgba(255, 255, 255, 0.05);
      color: var(--text-secondary);
    }

    .badge.plugin {
      background-color: rgba(168, 85, 247, 0.15);
      color: rgb(192, 132, 252);
      border: 1px solid rgba(168, 85, 247, 0.3);
    }

    .badge.skill {
      background-color: rgba(59, 130, 246, 0.15);
      color: rgb(147, 197, 253);
      border: 1px solid rgba(59, 130, 246, 0.3);
    }

    /* Modal Overlay */
    .overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      z-index: 100;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .modal-box {
      width: 500px;
      max-height: 85vh;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      gap: 1rem;
      overflow-y: auto;
    }

    .security-panel {
      padding: 0.75rem;
      border-radius: 6px;
      border: 1px solid var(--border-color);
      font-size: 0.8rem;
    }

    .security-panel.pass {
      background-color: var(--status-green-glow);
      border-color: rgba(0, 255, 100, 0.2);
    }

    .security-panel.fail {
      background-color: var(--status-red-glow);
      border-color: rgba(255, 51, 102, 0.2);
    }

    .security-panel.warn {
      background-color: var(--status-yellow-glow);
      border-color: rgba(255, 170, 0, 0.2);
    }

    code {
      font-family: var(--font-mono);
      font-size: 0.8rem;
      background-color: var(--bg-primary);
      padding: 0.15rem 0.3rem;
      border-radius: 4px;
      color: var(--accent-secondary);
    }

    /* Filters row */
    .filters-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      margin-bottom: 0.5rem;
    }

    .segment-bar {
      display: flex;
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      overflow: hidden;
    }

    .segment-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      padding: 0.4rem 0.8rem;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .segment-btn:hover {
      color: var(--text-primary);
    }

    .segment-btn.active {
      background-color: var(--border-color);
      color: var(--accent-secondary);
    }

    .trust-badge {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .trust-verified {
      background-color: rgba(16, 185, 129, 0.15);
      color: #10b981;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .trust-trusted {
      background-color: rgba(59, 130, 246, 0.15);
      color: #3b82f6;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }
    .trust-unknown {
      background-color: rgba(156, 163, 175, 0.15);
      color: #9ca3af;
      border: 1px solid rgba(156, 163, 175, 0.3);
    }
    .trust-suspicious {
      background-color: rgba(245, 158, 11, 0.15);
      color: #f59e0b;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }
    .trust-untrusted {
      background-color: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .circuit-badge {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.1rem 0.3rem;
      border-radius: 4px;
    }
    .circuit-closed {
      background-color: rgba(16, 185, 129, 0.2);
      color: #34d399;
    }
    .circuit-open {
      background-color: rgba(239, 68, 68, 0.2);
      color: #f87171;
    }
    .circuit-half {
      background-color: rgba(245, 158, 11, 0.2);
      color: #fbbf24;
    }

    .health-stats {
      font-size: 0.75rem;
      color: var(--text-secondary);
      background: var(--bg-tertiary);
      padding: 0.5rem;
      border-radius: 6px;
      margin-top: 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .sparkline {
      display: flex;
      gap: 0.15rem;
      align-items: center;
      margin-top: 0.2rem;
    }
    .spark-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
    .spark-success {
      background-color: #10b981;
    }
    .spark-fail {
      background-color: #ef4444;
    }

    .findings-btn {
      background: none;
      border: none;
      color: var(--accent-secondary);
      font-size: 0.75rem;
      cursor: pointer;
      text-decoration: underline;
      padding: 0;
      align-self: flex-start;
      margin-top: 0.25rem;
    }

    .findings-detail {
      font-size: 0.7rem;
      color: var(--text-muted);
      background: rgba(0,0,0,0.2);
      padding: 0.4rem;
      border-radius: 4px;
      margin-top: 0.25rem;
    }
  `}connectedCallback(){super.connectedCallback(),this.loadConfig(),this.loadLicenses()}async loadConfig(){try{let e=await this.wsClient.send(`getSystemConfig`);this.config=e.config,this.baseHash=e.hash,this.envKeys=this.config.env||{GEMINI_API_KEY:``,OPENAI_API_KEY:``,TELEGRAM_BOT_TOKEN:``},this.config.agents&&this.config.agents.length>0&&!this.selectedAgentId&&(this.selectedAgentId=this.config.agents[0].id),this.loadInstalledPackages()}catch(e){console.error(`[Skills] Failed to load configuration:`,e)}}handleAgentChange(e){this.selectedAgentId=e.target.value,this.loadInstalledPackages()}async loadInstalledPackages(){if(this.selectedAgentId){this.isInstalledLoading=!0;try{let e=await this.wsClient.send(`listAgentSkills`,{agentId:this.selectedAgentId});this.installedSkills=e.skills||[],this.installedPlugins=e.plugins||[],this.learnedSkills=e.learnedSkills||[],this.skillsHealth=await this.wsClient.send(`getAgentSkillsHealth`,{agentId:this.selectedAgentId})}catch(e){console.error(`[Skills] Failed to load installed packages or health:`,e)}finally{this.isInstalledLoading=!1}}}async toggleCircuitBreaker(e,t){let n=t===`OPEN`?`CLOSED`:`OPEN`;try{await this.wsClient.send(`toggleSkillCircuit`,{agentId:this.selectedAgentId,skillName:e,state:n}),this.loadInstalledPackages()}catch(e){alert(`Error toggling circuit state: ${e.message}`)}}toggleFindings(e){this.expandedFindings={...this.expandedFindings,[e]:!this.expandedFindings[e]}}async uninstallPackage(e,t,n){if(confirm(`Are you sure you want to uninstall the ${t} '${e}'?`))try{await this.wsClient.send(`uninstallSkill`,{agentId:this.selectedAgentId,name:e,type:t,global:n}),alert(`Successfully uninstalled ${t} '${e}'.`),this.loadInstalledPackages()}catch(e){alert(`Error uninstalling: ${e.message}`)}}async loadLicenses(){try{let e=await this.wsClient.send(`listClawhubLicenses`);this.licenses=e.licenses||[]}catch(e){console.error(`[Skills] Failed to load licenses:`,e)}}async searchClawHub(){this.isSearching=!0;try{let e=await this.wsClient.send(`searchClawhubSkills`,{query:this.searchQuery});this.searchResults=e.results||[]}catch(e){console.error(`[Skills] ClawHub search failed:`,e)}finally{this.isSearching=!1}}openInstallDialog(e){this.selectedSkill=e,this.targetAgentId=this.config.agents[0]?.id||`global`,this.installStatus=``,this.isInstalling=!1,this.checkSecurityPolicy(),this.isInstallModalOpen=!0}checkSecurityPolicy(){if(!this.selectedSkill)return;let e=this.selectedSkill,t=[],n=!0,r=``;if(e.verified||t.push(`Unverified publisher capability. Code has not been audited by ClawHub.`),this.targetAgentId!==`global`){let t=this.config.agents.find(e=>e.id===this.targetAgentId),i=t?.toolPolicy?.allowedTools||t?.tools||[];for(let t of e.permissions.allowedTools)if(!i.includes(t)){n=!1,r=`Target agent '${this.targetAgentId}' does not have allowed permission for required tool '${t}'. Deny-always-wins security rule violated.`;break}}this.securityResult={passed:n,error:r,warnings:t}}handleTargetAgentChange(e){this.targetAgentId=e.target.value,this.checkSecurityPolicy()}async installSkill(){if(this.selectedSkill){this.isInstalling=!0,this.installStatus=`Validating security checklist...`;try{await this.wsClient.send(`installSkill`,{agentId:this.targetAgentId,packageUrl:this.selectedSkill.slug,type:`skill`,name:this.selectedSkill.name}),this.installStatus=`Installation succeeded! Capability hot-loaded.`,setTimeout(()=>{this.isInstallModalOpen=!1,this.loadConfig()},1500)}catch(e){this.installStatus=`Installation rejected: ${e.message}`}finally{this.isInstalling=!1}}}handleToolToggle(e,t){this.config&&(this.config.agents=this.config.agents.map(n=>{if(n.id===this.selectedAgentId){let r=[...n.tools||[]];return t?r.includes(e)||r.push(e):r=r.filter(t=>t!==e),{...n,tools:r}}return n}),this.requestUpdate())}async saveSettings(){let e={...this.config,env:this.envKeys};try{let t=await this.wsClient.send(`saveSystemConfig`,{config:e,baseHash:this.baseHash});t.conflict?(alert(`Conflict Error: Config modified. Reloading...`),await this.loadConfig()):t.success?(this.baseHash=t.hash,alert(`Agent capabilities updated successfully.`)):alert(`Failed to save changes.`)}catch(e){console.error(`[Skills] Failed to save capabilities:`,e)}}render(){return this.config?S`
      <div class="title-row">
        <div class="title">Agent Capabilities & Skills Manager</div>
      </div>

      <div class="tab-bar">
        <button class="tab-item ${this.currentTab===`capabilities`?`active`:``}" @click=${()=>this.currentTab=`capabilities`}>
          🛠️ Agent Capabilities
        </button>
        <button class="tab-item ${this.currentTab===`installed`?`active`:``}" @click=${()=>{this.currentTab=`installed`,this.loadInstalledPackages()}}>
          📦 Installed Packages
        </button>
        <button class="tab-item ${this.currentTab===`learned`?`active`:``}" @click=${()=>{this.currentTab=`learned`,this.loadInstalledPackages()}}>
          🧠 Learned Skills
        </button>
        <button class="tab-item ${this.currentTab===`clawhub`?`active`:``}" @click=${()=>{this.currentTab=`clawhub`,this.searchClawHub()}}>
          🌍 Browse ClawHub Registry
        </button>
      </div>

      ${this.currentTab===`capabilities`?this.renderCapabilitiesTab():this.currentTab===`installed`?this.renderInstalledTab():this.currentTab===`learned`?this.renderLearnedTab():this.renderClawHubTab()}

      <!-- Install Confirm Modal -->
      ${this.isInstallModalOpen&&this.selectedSkill?S`
        <div class="overlay" @click=${()=>this.isInstallModalOpen=!1}>
          <div class="modal-box" @click=${e=>e.stopPropagation()}>
            <h3 style="margin-top: 0">Install ClawHub Skill / Plugin</h3>
            <div>Installing <strong>${this.selectedSkill.name}</strong> (<code>${this.selectedSkill.slug}</code>)</div>

            <div class="form-group">
              <label for="installTarget">Target Agent Scope</label>
              <select id="installTarget" .value=${this.targetAgentId} @change=${this.handleTargetAgentChange}>
                <option value="global">Global (Shared by all agents)</option>
                ${this.config.agents.map(e=>S`
                  <option value=${e.id}>${e.name||e.id}</option>
                `)}
              </select>
            </div>

            <!-- Security Audit Pre-check -->
            ${this.securityResult?S`
              <div class="security-panel ${this.securityResult.passed?this.securityResult.warnings.length>0?`warn`:`pass`:`fail`}">
                <div style="font-weight: bold; margin-bottom: 0.25rem;">
                  🛡️ Security Audit: ${this.securityResult.passed?this.securityResult.warnings.length>0?`WARNINGS`:`PASSED`:`FAILED`}
                </div>
                ${this.securityResult.passed?S`
                  <div style="color: var(--status-green);">This capability complies with the target agent's tool policy boundaries.</div>
                `:S`
                  <div style="color: var(--status-red);">${this.securityResult.error}</div>
                `}
                ${this.securityResult.warnings.map(e=>S`
                  <div style="color: var(--status-yellow); margin-top: 0.25rem;">• ${e}</div>
                `)}
              </div>
            `:``}

            ${this.installStatus?S`
              <div style="font-size: 0.85rem; color: var(--accent-secondary); background: var(--bg-primary); padding: 0.5rem; border-radius: 4px; font-family: var(--font-mono)">
                ${this.installStatus}
              </div>
            `:``}

            <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
              <button 
                class="btn" 
                style="flex: 1;" 
                @click=${this.installSkill}
                ?disabled=${this.isInstalling||this.securityResult&&!this.securityResult.passed}
              >
                📥 Confirm Install
              </button>
              <button class="btn btn-secondary" @click=${()=>this.isInstallModalOpen=!1}>Cancel</button>
            </div>
          </div>
        </div>
      `:``}
    `:S`<div>Loading agent settings...</div>`}renderCapabilitiesTab(){let e=this.config.agents.find(e=>e.id===this.selectedAgentId),t=e&&(e.tools||e.toolPolicy?.allowedTools)||[];return S`
      <div class="layout">
        <!-- Tools List Grid -->
        <div class="panel">
          <div class="panel-header">
            <span>Enabled Tool System APIs</span>
            <select .value=${this.selectedAgentId} @change=${this.handleAgentChange}>
              ${this.config.agents.map(e=>S`
                <option value=${e.id}>${e.name||e.id}</option>
              `)}
            </select>
          </div>

          <div class="skills-grid">
            ${this.availableTools.map(e=>S`
                <div class="skill-card">
                  <input 
                    type="checkbox" 
                    class="skill-checkbox" 
                    .checked=${t.includes(e.name)}
                    @change=${t=>this.handleToolToggle(e.name,t.target.checked)}
                  />
                  <div class="skill-info">
                    <div style="display:flex; align-items:center; gap:0.5rem">
                      <span class="skill-name">${e.name}</span>
                      <span class="skill-category">${e.category}</span>
                    </div>
                    <span class="skill-desc">${e.desc}</span>
                  </div>
                </div>
              `)}
          </div>
        </div>

        <!-- Right Side Env Setup -->
        <div class="panel">
          <div class="panel-header">
            <span>Security Key Vault</span>
          </div>

          <div class="env-form">
            <div class="form-group">
              <label for="geminiKey">Gemini AI API Key</label>
              <input 
                type="password" 
                id="geminiKey" 
                placeholder="AIzaSy..." 
                .value=${this.envKeys.GEMINI_API_KEY||``}
                @input=${e=>this.envKeys={...this.envKeys,GEMINI_API_KEY:e.target.value}}
              />
            </div>

            <div class="form-group">
              <label for="openaiKey">OpenAI API Key (Optional)</label>
              <input 
                type="password" 
                id="openaiKey" 
                placeholder="sk-proj-..." 
                .value=${this.envKeys.OPENAI_API_KEY||``}
                @input=${e=>this.envKeys={...this.envKeys,OPENAI_API_KEY:e.target.value}}
              />
            </div>

            <div class="form-group">
              <label for="anthropicKey">Anthropic API Key (Optional)</label>
              <input 
                type="password" 
                id="anthropicKey" 
                placeholder="sk-ant-..." 
                .value=${this.envKeys.ANTHROPIC_API_KEY||``}
                @input=${e=>this.envKeys={...this.envKeys,ANTHROPIC_API_KEY:e.target.value}}
              />
            </div>

            <button class="btn" @click=${this.saveSettings}>💾 Save capabilities</button>
          </div>
        </div>
      </div>
    `}renderClawHubTab(){let e=this.searchResults.filter(e=>{let t=e.category?.toLowerCase().includes(`plugin`)||e.slug?.toLowerCase().includes(`plugin`)||e.name?.toLowerCase().includes(`plugin`)||e.description?.toLowerCase().includes(`plugin`);return!(this.filterType===`skills`&&t||this.filterType===`plugins`&&!t)});return S`
      <div class="panel">
        <div class="panel-header">Browse & Search ClawHub Skills and Plugins</div>
        
        <div class="filters-row">
          <div style="display: flex; gap: 0.5rem; flex: 1;">
            <input 
              type="text" 
              placeholder="Search ClawHub (e.g. calendar, slack, database)..." 
              style="flex: 1;"
              .value=${this.searchQuery}
              @input=${e=>this.searchQuery=e.target.value}
              @keydown=${e=>e.key===`Enter`&&this.searchClawHub()}
            />
            <button class="btn" @click=${this.searchClawHub} ?disabled=${this.isSearching}>
              ${this.isSearching?`Searching...`:`🔍 Search ClawHub`}
            </button>
          </div>

          <div class="segment-bar">
            <button class="segment-btn ${this.filterType===`all`?`active`:``}" @click=${()=>this.filterType=`all`}>
              All
            </button>
            <button class="segment-btn ${this.filterType===`skills`?`active`:``}" @click=${()=>this.filterType=`skills`}>
              📖 Skills
            </button>
            <button class="segment-btn ${this.filterType===`plugins`?`active`:``}" @click=${()=>this.filterType=`plugins`}>
              🔌 Plugins
            </button>
          </div>
        </div>

        <div class="clawhub-grid">
          ${e.length===0?S`
            <div style="grid-column: span 3; text-align: center; color: var(--text-muted); padding: 2rem;">
              No ClawHub packages found. Try typing 'calendar' or 'slack'.
            </div>
          `:e.map(e=>{let t=e.category?.toLowerCase().includes(`plugin`)||e.slug?.toLowerCase().includes(`plugin`)||e.name?.toLowerCase().includes(`plugin`)||e.description?.toLowerCase().includes(`plugin`),n=e.price===0||this.licenses.includes(e.slug);return S`
              <div class="ch-card">
                <div class="ch-title-row">
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div class="ch-name">${e.name}</div>
                    <span class="badge ${t?`plugin`:`skill`}">
                      ${t?`🔌 Plugin`:`📖 Skill`}
                    </span>
                  </div>
                  <span class="badge ${e.verified?`verified`:`unverified`}">
                    ${e.verified?`Verified`:`Unverified`}
                  </span>
                </div>
                <div class="ch-slug">${e.slug}</div>
                <div class="ch-desc">${e.description}</div>
                
                <div class="ch-meta">
                  <div>Publisher: <strong>${e.publisher}</strong></div>
                  <div>Rating: 🌟 <strong>${e.rating} / 5</strong></div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.25rem;">
                    <span class="badge price">${e.price===0?`FREE`:`$`+e.price}</span>
                    <button 
                      class="btn btn-secondary" 
                      style="font-size: 0.75rem; padding: 0.25rem 0.5rem;"
                      @click=${()=>this.openInstallDialog(e)}
                    >
                      ${n?`📥 Install`:`🔒 Buy & Install`}
                    </button>
                  </div>
                </div>
              </div>
            `})}
        </div>
      </div>
    `}renderInstalledTab(){let e=[...this.installedSkills.map(e=>({...e,type:`skill`})),...this.installedPlugins.map(e=>({...e,type:`plugin`}))].filter(e=>!(this.filterType===`skills`&&e.type!==`skill`||this.filterType===`plugins`&&e.type!==`plugin`));return S`
      <div class="panel">
        <div class="panel-header">
          <span>Installed ClawHub Skills & Plugins</span>
          <div style="display: flex; gap: 1rem; align-items: center;">
            <label style="margin: 0; font-size: 0.85rem; color: var(--text-secondary);">Active Agent:</label>
            <select .value=${this.selectedAgentId} @change=${this.handleAgentChange}>
              ${this.config.agents.map(e=>S`
                <option value=${e.id}>${e.name||e.id}</option>
              `)}
            </select>
          </div>
        </div>

        <div class="filters-row">
          <div style="font-size: 0.85rem; color: var(--text-secondary)">
            Showing ${e.length} installed packages
          </div>

          <div class="segment-bar">
            <button class="segment-btn ${this.filterType===`all`?`active`:``}" @click=${()=>this.filterType=`all`}>
              All
            </button>
            <button class="segment-btn ${this.filterType===`skills`?`active`:``}" @click=${()=>this.filterType=`skills`}>
              📖 Skills
            </button>
            <button class="segment-btn ${this.filterType===`plugins`?`active`:``}" @click=${()=>this.filterType=`plugins`}>
              🔌 Plugins
            </button>
          </div>
        </div>

        ${this.isInstalledLoading?S`
          <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
            Loading installed packages...
          </div>
        `:e.length===0?S`
          <div style="text-align: center; color: var(--text-muted); padding: 3rem; background: var(--bg-tertiary); border-radius: 8px; border: 1px dashed var(--border-color)">
            No skills or plugins installed for this agent.
            <div style="margin-top: 1rem;">
              <button class="btn btn-secondary" style="font-size: 0.85rem;" @click=${()=>{this.currentTab=`clawhub`,this.searchClawHub()}}>
                Browse ClawHub Registry
              </button>
            </div>
          </div>
        `:S`
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem;">
            ${e.map(e=>{let t=this.skillsHealth[e.name]||{state:`CLOSED`,successRate:1,runs:0,history:[]},n=!!this.expandedFindings[e.name],r=`trust-${(e.trustScore||`unknown`).toLowerCase()}`;return S`
                <div class="ch-card">
                  <div class="ch-title-row">
                    <div style="display: flex; align-items: center; gap: 0.5rem; overflow: hidden;">
                      <div class="ch-name" style="font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;" title=${e.name}>${e.name}</div>
                      <span class="badge ${e.type===`plugin`?`plugin`:`skill`}">
                        ${e.type===`plugin`?`🔌 Plugin`:`📖 Skill`}
                      </span>
                    </div>
                    <span class="trust-badge ${r}">
                      ${e.trustScore||`unknown`}
                    </span>
                  </div>
                  <div class="ch-slug" style="font-size: 0.7rem; color: var(--text-muted);">Version: ${e.version||`1.0.0`} | Scope: ${e.scope}</div>
                  <div class="ch-desc" style="font-size: 0.8rem; margin: 0.25rem 0 0.5rem 0;">${e.description||`No description provided.`}</div>
                  
                  <!-- Health & Circuit Telemetry -->
                  <div class="health-stats">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span>Circuit State:</span>
                      <span class="circuit-badge ${t.state===`OPEN`?`circuit-open`:t.state===`HALF_OPEN`?`circuit-half`:`circuit-closed`}">
                        ${t.state}
                      </span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                      <span>Success Rate:</span>
                      <strong>${(t.successRate*100).toFixed(0)}% (${t.runs} runs)</strong>
                    </div>
                    ${t.history&&t.history.length>0?S`
                      <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>Recent:</span>
                        <div class="sparkline">
                          ${t.history.map(e=>S`
                            <span class="spark-dot ${e?`spark-success`:`spark-fail`}"></span>
                          `)}
                        </div>
                      </div>
                    `:``}
                  </div>

                  <!-- Trust Findings -->
                  ${e.trustFindings&&e.trustFindings.length>0?S`
                    <button class="findings-btn" @click=${()=>this.toggleFindings(e.name)}>
                      ${n?`Hide Trust Details`:`Show Trust Details`}
                    </button>
                    ${n?S`
                      <div class="findings-detail">
                        <strong>Verification Findings:</strong>
                        ${e.trustFindings.map(e=>S`<div style="margin-top: 0.15rem;">• ${e}</div>`)}
                      </div>
                    `:``}
                  `:``}

                  <div class="ch-meta" style="margin-top: auto; padding-top: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                    <div>Publisher: <strong>${e.publisher||`Community`}</strong></div>
                    <div style="display: flex; gap: 0.4rem;">
                      <button 
                        class="btn btn-secondary" 
                        style="font-size: 0.75rem; padding: 0.25rem 0.5rem; ${t.state===`OPEN`?`border-color: var(--status-green); color: var(--status-green);`:`border-color: var(--status-yellow); color: var(--status-yellow);`} background: transparent;"
                        @click=${()=>this.toggleCircuitBreaker(e.name,t.state)}
                      >
                        ${t.state===`OPEN`?`⚡ Enable`:`🛑 Disable`}
                      </button>
                      <button 
                        class="btn btn-secondary" 
                        style="font-size: 0.75rem; padding: 0.25rem 0.5rem; border-color: var(--status-red); color: var(--status-red); background: transparent;"
                        @click=${()=>this.uninstallPackage(e.name,e.type,e.scope===`global`)}
                      >
                        🗑️ Uninstall
                      </button>
                    </div>
                  </div>
                </div>
              `})}
          </div>
        `}
      </div>
    `}renderLearnedTab(){return S`
      <div class="panel">
        <div class="panel-header">
          <span>🧠 Closed-Loop Learned Skills</span>
          <div style="display: flex; gap: 1rem; align-items: center;">
            <label style="margin: 0; font-size: 0.85rem; color: var(--text-secondary);">Active Agent:</label>
            <select .value=${this.selectedAgentId} @change=${this.handleAgentChange}>
              ${this.config.agents.map(e=>S`
                <option value=${e.id}>${e.name||e.id}</option>
              `)}
            </select>
          </div>
        </div>

        <div class="filters-row">
          <div style="font-size: 0.85rem; color: var(--text-secondary)">
            Showing ${this.learnedSkills.length} learned skills
          </div>
        </div>

        ${this.isInstalledLoading?S`
          <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
            Loading learned skills...
          </div>
        `:this.learnedSkills.length===0?S`
          <div style="text-align: center; color: var(--text-muted); padding: 3rem; background: var(--bg-tertiary); border-radius: 8px; border: 1px dashed var(--border-color)">
            No skills learned by this agent yet.
            <div style="margin-top: 0.5rem; font-size: 0.8rem;">
              Skills are automatically learned from experience through Reflection triggers.
            </div>
          </div>
        `:S`
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem;">
            ${this.learnedSkills.map(e=>S`
              <div class="ch-card">
                <div class="ch-title-row">
                  <div style="display: flex; align-items: center; gap: 0.5rem; overflow: hidden;">
                    <div class="ch-name" style="font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title=${e.name}>${e.name}</div>
                  </div>
                  <span class="badge ${e.status===`promoted`?`verified`:e.status===`archived`?`unverified`:`skill`}" style="text-transform: uppercase;">
                    ${e.status}
                  </span>
                </div>
                <div class="ch-slug" style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono)">Slug: ${e.slug}</div>
                <div class="ch-desc" style="font-size: 0.8rem; margin: 0.25rem 0 0.5rem 0;">${e.description||`No description provided.`}</div>
                
                <div class="ch-meta" style="margin-top: auto; padding-top: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.75rem; color: var(--text-secondary);">
                  <div>Trigger: <strong>${e.triggerType}</strong></div>
                  <div>Created: <strong>${e.createdDate}</strong></div>
                  <div>Usage Count: <strong>${e.usageCount}</strong></div>
                  <div>Success Rate: <strong>${e.successRate.toFixed(1)}%</strong></div>
                </div>
              </div>
            `)}
          </div>
        `}
      </div>
    `}};e([A()],B.prototype,`config`,void 0),e([A()],B.prototype,`baseHash`,void 0),e([A()],B.prototype,`selectedAgentId`,void 0),e([A()],B.prototype,`envKeys`,void 0),e([A()],B.prototype,`currentTab`,void 0),e([A()],B.prototype,`filterType`,void 0),e([A()],B.prototype,`installedSkills`,void 0),e([A()],B.prototype,`installedPlugins`,void 0),e([A()],B.prototype,`learnedSkills`,void 0),e([A()],B.prototype,`isInstalledLoading`,void 0),e([A()],B.prototype,`skillsHealth`,void 0),e([A()],B.prototype,`expandedFindings`,void 0),e([A()],B.prototype,`searchQuery`,void 0),e([A()],B.prototype,`searchResults`,void 0),e([A()],B.prototype,`isSearching`,void 0),e([A()],B.prototype,`licenses`,void 0),e([A()],B.prototype,`isInstallModalOpen`,void 0),e([A()],B.prototype,`selectedSkill`,void 0),e([A()],B.prototype,`targetAgentId`,void 0),e([A()],B.prototype,`installStatus`,void 0),e([A()],B.prototype,`isInstalling`,void 0),e([A()],B.prototype,`securityResult`,void 0),B=e([k(`skills-page`)],B);var V=class extends O{constructor(...e){super(...e),this.activeAgent=``,this.config=null,this.agents=[],this.wsClient=j.getInstance(),this.steps=[{id:`assemble`,name:`Prompt Assembler`,desc:`Injects workspace variables, MEMORY.md, and tool declarations.`,latency:`18ms`,status:`completed`},{id:`model`,name:`Generative Model Loop`,desc:`Performs reasoning iterations and returns tool calls/text replies.`,latency:`2.8s`,status:`completed`},{id:`tool`,name:`Tool Exec Engine`,desc:`Invokes custom terminal commands and file system API tools.`,latency:`140ms`,status:`completed`},{id:`memory`,name:`Memory Stack Write`,desc:`Appends turn to session.jsonl facts and indexes embeddings.`,latency:`12ms`,status:`completed`},{id:`dispatch`,name:`Event Bus Dispatcher`,desc:`Broadcasts output frames to connected peer channels and agents.`,latency:`4ms`,status:`idle`}],this.handleBusMessage=(e,t)=>{if(e===`busMessage`&&t.topic===`loop_progress`){let{message:e}=t;if(!e||!e.event)return;let n=e.event;if(n.agentId&&n.agentId!==this.activeAgent)return;this.updatePipelineFromEvent(n)}}}static{this.styles=s`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .title {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .panel {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 1.5rem;
    }

    select {
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      padding: 0.4rem 0.6rem;
      outline: none;
      font-size: 0.85rem;
    }

    /* Pipeline map styles */
    .pipeline-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      position: relative;
      margin-top: 1rem;
    }

    .pipeline-line {
      position: absolute;
      left: 20px;
      top: 10px;
      bottom: 10px;
      width: 4px;
      background-color: var(--border-color);
      z-index: 1;
    }

    .step-card {
      display: flex;
      gap: 1.5rem;
      align-items: center;
      position: relative;
      z-index: 2;
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1rem;
      transition: all 0.3s;
      cursor: pointer;
    }

    .step-card:hover {
      border-color: var(--accent-primary);
    }

    .step-dot {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--bg-primary);
      border: 3px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      color: var(--text-muted);
      transition: all 0.3s;
    }

    .step-card.active .step-dot {
      border-color: var(--accent-primary);
      color: var(--accent-primary);
      box-shadow: 0 0 10px var(--accent-primary);
      animation: pulseGlow 1.5s infinite;
    }

    .step-card.completed .step-dot {
      border-color: var(--status-green);
      color: var(--status-green);
    }

    .step-card.active {
      background-color: var(--accent-glow);
    }

    .step-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .step-name {
      font-weight: 600;
      font-size: 1.05rem;
      color: var(--text-primary);
    }

    .step-desc {
      font-size: 0.85rem;
      color: var(--text-secondary);
    }

    .step-latency {
      font-family: var(--font-mono);
      font-size: 0.85rem;
      color: var(--accent-secondary);
      background: var(--bg-primary);
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      border: 1px solid var(--border-color);
    }
  `}connectedCallback(){super.connectedCallback(),this.loadConfig(),this.wsClient.addEventListener(this.handleBusMessage)}disconnectedCallback(){super.disconnectedCallback(),this.wsClient.removeEventListener(this.handleBusMessage)}updatePipelineFromEvent(e){let t=e.type,n=e.durationMs?`${e.durationMs}ms`:void 0;this.steps=this.steps.map(e=>{let r=e.status;switch(e.id){case`assemble`:t===`compaction_start`||t===`before_run`?r=`active`:(t===`compaction_end`||t===`thinking_stream`||t===`thinking`||t===`tool_start`||t===`turn_end`)&&(r=`completed`);break;case`model`:t===`thinking_stream`||t===`thinking`?r=`active`:t===`tool_start`||t===`turn_end`?r=`completed`:(t===`compaction_start`||t===`before_run`)&&(r=`idle`);break;case`tool`:t===`tool_start`?r=`active`:t===`tool_end`||t===`turn_end`?r=`completed`:(t===`compaction_start`||t===`before_run`||t===`thinking`)&&(r=`idle`);break;case`memory`:t===`turn_end`?r=`completed`:(t===`compaction_start`||t===`before_run`)&&(r=`idle`);break;case`dispatch`:t===`bus_send`?r=`active`:t===`turn_end`?r=`completed`:(t===`compaction_start`||t===`before_run`)&&(r=`idle`);break}let i=e.latency;return n&&(e.id===`tool`&&(t===`tool_start`||t===`tool_end`)||e.id===`model`&&(t===`thinking`||t===`thinking_stream`))&&(i=n),{...e,status:r,latency:i}})}async loadConfig(){try{let e=await this.wsClient.send(`getSystemConfig`);this.config=e.config,this.agents=this.config.agents||[],this.agents.length>0&&!this.activeAgent&&(this.activeAgent=this.agents[0].id)}catch(e){console.error(`[NodesPage] Failed to load configuration:`,e)}}render(){return S`
      <div class="title-row">
        <div class="title">Execution Pipeline Node Graph</div>
        <select .value=${this.activeAgent} @change=${e=>this.activeAgent=e.target.value}>
          ${this.agents.map(e=>S`
            <option value=${e.id}>${e.name||e.id}</option>
          `)}
        </select>
      </div>

      <div class="panel">
        <div class="pipeline-container">
          <div class="pipeline-line"></div>
          
          ${this.steps.map((e,t)=>S`
            <div class="step-card ${e.status}">
              <div class="step-dot">
                ${e.status===`completed`?`✓`:t+1}
              </div>
              <div class="step-details">
                <div class="step-name">${e.name}</div>
                <div class="step-desc">${e.desc}</div>
              </div>
              <div>
                <span class="step-latency">${e.latency}</span>
              </div>
            </div>
          `)}
        </div>
      </div>
    `}};e([A()],V.prototype,`activeAgent`,void 0),e([A()],V.prototype,`config`,void 0),e([A()],V.prototype,`agents`,void 0),e([A()],V.prototype,`wsClient`,void 0),e([A()],V.prototype,`steps`,void 0),V=e([k(`nodes-page`)],V);var H=class extends O{constructor(...e){super(...e),this.logs=[],this.config=null,this.agents=[],this.activeAnimation={},this.wsClient=j.getInstance()}static{this.styles=s`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .title {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .grid {
      display: grid;
      grid-template-columns: 320px 1fr;
      gap: 1.5rem;
    }

    .panel {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .panel-header {
      font-family: var(--font-display);
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-primary);
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.5rem;
    }

    /* Live events terminal */
    .terminal {
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 1rem;
      font-family: var(--font-mono);
      font-size: 0.8rem;
      color: var(--text-secondary);
      height: 300px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .log-entry {
      border-bottom: 1px solid rgba(255,255,255,0.03);
      padding-bottom: 0.25rem;
      word-break: break-all;
    }

    .log-time {
      color: var(--text-muted);
    }

    .log-topic {
      color: var(--accent-secondary);
    }

    /* Graph Visuals */
    .graph-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 300px;
      position: relative;
    }

    svg {
      width: 100%;
      max-width: 500px;
      height: 280px;
    }

    .node-circle {
      fill: var(--bg-tertiary);
      stroke: var(--border-color);
      stroke-width: 2px;
      transition: all 0.3s;
    }

    .node-circle.active {
      stroke: var(--accent-secondary);
      fill: rgba(0, 240, 255, 0.1);
      filter: drop-shadow(0px 0px 8px var(--accent-secondary));
    }

    .link-line {
      fill: none;
      stroke: var(--border-color);
      stroke-width: 2px;
      transition: stroke 0.3s;
    }

    /* Glowing Flow Particle */
    .particle {
      fill: var(--accent-secondary);
      filter: drop-shadow(0px 0px 4px var(--accent-secondary));
    }

    .text-name {
      font-weight: 600;
      font-size: 12px;
      fill: var(--text-primary);
      text-anchor: middle;
      font-family: var(--font-sans);
    }

    .text-title {
      font-size: 10px;
      fill: var(--text-muted);
      text-anchor: middle;
      font-family: var(--font-sans);
    }
  `}connectedCallback(){super.connectedCallback(),this.loadConfig(),this.wsClient.addEventListener(this.handleBusEvent.bind(this))}async loadConfig(){let e=this.wsClient.getToken();try{let t=await fetch(`${this.wsClient.getGatewayUrl()}/api/config`,{method:`GET`,headers:{Authorization:`Bearer ${e}`}});if(t.ok){let e=await t.json();this.config=e.config,this.agents=this.config.agents||[]}}catch(e){console.error(`[BusMonitor] Failed to load configuration:`,e)}}disconnectedCallback(){super.disconnectedCallback(),this.wsClient.removeEventListener(this.handleBusEvent.bind(this))}handleBusEvent(e,t){if(e===`busMessage`){let{topic:e,message:n}=t,r=typeof n==`string`?n:JSON.stringify(n),i=n.from||`gateway`,a=`gateway`;e.startsWith(`agent:`)?a=e.split(`:`)[1]:e.startsWith(`chat:`)&&(a=`gateway`);let o=this.agents.length,s=this.agents.map((e,t)=>{let n=t*2*Math.PI/(o||1)-Math.PI/2;return{id:e.id,x:200+80*Math.cos(n),y:130+80*Math.sin(n)}}),c=e=>{if(e===`gateway`)return{x:200,y:130};let t=s.find(t=>t.id===e);return t?{x:t.x,y:t.y}:{x:200,y:130}},l=c(i),u=c(a);this.triggerMessageAnimation(i,a,l.x,l.y,u.x,u.y);let d={id:crypto.randomUUID(),timestamp:Date.now(),topic:e,sender:i,receiver:a,content:r};this.logs=[d,...this.logs].slice(0,50)}}triggerMessageAnimation(e,t,n,r,i,a){this.activeAnimation={senderId:e,receiverId:t,senderX:n,senderY:r,receiverX:i,receiverY:a},setTimeout(()=>{this.activeAnimation.senderId===e&&this.activeAnimation.receiverId===t&&(this.activeAnimation={})},1200)}render(){let e=this.agents.length,t=this.agents.map((t,n)=>{let r=n*2*Math.PI/(e||1)-Math.PI/2;return{id:t.id,name:t.name||t.id,x:200+80*Math.cos(r),y:130+80*Math.sin(r)}}),n={id:`gateway`,name:`Gateway Hub`,x:200,y:130};return S`
      <div class="title">Event Bus Messaging Monitor</div>

      <div class="grid">
        <!-- SVG Node Graph -->
        <div class="panel" style="align-items: center">
          <div class="panel-header" style="width: 100%">Bus Visualizer</div>
          <div class="graph-container">
            <svg viewBox="0 0 400 260">
              <!-- Central Hub Links -->
              ${t.map(e=>S`
                <line 
                  class="link-line" 
                  x1=${e.x} y1=${e.y} 
                  x2=${n.x} y2=${n.y} 
                  style="stroke: var(--border-color); stroke-width: 1.5px; opacity: 0.5;"
                />
              `)}

              <!-- Traveling particle animations -->
              ${this.activeAnimation.senderX!==void 0&&this.activeAnimation.receiverX!==void 0?S`
                <path 
                  id="active-flow-path" 
                  class="link-line" 
                  d="M ${this.activeAnimation.senderX} ${this.activeAnimation.senderY} L ${this.activeAnimation.receiverX} ${this.activeAnimation.receiverY}" 
                  style="stroke: var(--accent-secondary); stroke-width: 2.5px; stroke-dasharray: 4; animation: dash 1s linear infinite;"
                />
                <circle class="particle" r="6">
                  <animateMotion 
                    dur="0.8s" 
                    repeatCount="1" 
                    fill="remove"
                  >
                    <mpath href="#active-flow-path" />
                  </animateMotion>
                </circle>
              `:``}

              <!-- Center Hub Node -->
              <g transform="translate(${n.x}, ${n.y})">
                <circle class="node-circle active" r="28" style="fill: rgba(138, 43, 226, 0.15); stroke: var(--accent-primary);" />
                <text class="text-name" y="4" style="font-size: 10px;">GATEWAY</text>
              </g>

              <!-- Agent Nodes -->
              ${t.map(e=>{let t=this.activeAnimation.senderId===e.id||this.activeAnimation.receiverId===e.id;return S`
                  <g transform="translate(${e.x}, ${e.y})">
                    <circle class="node-circle ${t?`active`:``}" r="22" />
                    <text class="text-name" y="4" style="font-size: 9px;">${e.name.slice(0,7)}</text>
                    <text class="text-title" y="32">${e.id}</text>
                  </g>
                `})}
            </svg>
          </div>
        </div>

        <!-- Terminal Logs -->
        <div class="panel">
          <div class="panel-header">Live Event Streaming Logs</div>
          <div class="terminal">
            ${this.logs.length===0?S`
              <div style="color: var(--text-muted); font-style: italic">
                Listening for messages on global bus topic (*) ...
              </div>
            `:this.logs.map(e=>S`
              <div class="log-entry">
                <span class="log-time">[${new Date(e.timestamp).toLocaleTimeString()}]</span>
                <span class="log-topic">topic:${e.topic}</span>
                <span><strong>${e.sender}</strong> ➔ <strong>${e.receiver}</strong>: ${e.content}</span>
              </div>
            `)}
          </div>
        </div>
      </div>
    `}};e([A()],H.prototype,`logs`,void 0),e([A()],H.prototype,`config`,void 0),e([A()],H.prototype,`agents`,void 0),e([A()],H.prototype,`activeAnimation`,void 0),H=e([k(`bus-monitor-page`)],H);var U=class extends O{constructor(...e){super(...e),this.config=null,this.baseHash=``,this.agents=[],this.providers=[],this.models=[],this.agentStats={},this.agentIntelligence={},this.curatingAgentId=null,this.curateStatusMsg=``,this.isWizardOpen=!1,this.wizardStep=1,this.isConfigPanelOpen=!1,this.activeTab=`identity`,this.inlineMemoryContent=``,this.agentId=``,this.agentName=``,this.agentWorkspace=``,this.agentProv=``,this.agentModel=``,this.agentTemp=.4,this.agentMaxTokens=4096,this.agentSandbox=`none`,this.agentTools=[],this.agentBotToken=``,this.agentBotAllowedUsers=``,this.allowUnrestrictedCommands=!1,this.allowSelfImprovement=!1,this.agentApiKey=``,this.wsClient=j.getInstance(),this.statsInterval=null,this.availableTools=[{name:`read_file`,desc:`View file contents recursively.`,category:`File Systems`},{name:`write_file`,desc:`Create and overwrite workspace files.`,category:`File Systems`},{name:`edit_file`,desc:`Inline find-and-replace line edits.`,category:`File Systems`},{name:`append_file`,desc:`Append text to files without overwriting.`,category:`File Systems`},{name:`list_dir`,desc:`Tree-style view of directories.`,category:`File Systems`},{name:`exec`,desc:`Run terminal shell commands on host.`,category:`Shell Operations`},{name:`web_search`,desc:`Search the web using DuckDuckGo snippets.`,category:`Web Services`},{name:`web_fetch`,desc:`Fetch webpage HTML converted to text.`,category:`Web Services`},{name:`http_stream`,desc:`Stream large REST API payloads.`,category:`Web Services`},{name:`think`,desc:`Private agent reasoning scratchpad.`,category:`Cognitive`},{name:`spawn_subagent`,desc:`Spawn background helper sub-agents.`,category:`Collaboration`}]}static{this.styles=s`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      font-family: var(--font-display, "Inter", sans-serif);
      color: var(--text-primary);
    }

    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .title {
      font-size: 1.75rem;
      font-weight: 800;
      background: linear-gradient(135deg, #a78bfa 0%, #ec4899 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .list-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 1.5rem;
    }

    /* Premium Pulsing Mood Card */
    .card {
      background: rgba(30, 30, 40, 0.6);
      border: 2px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      position: relative;
      overflow: hidden;
      backdrop-filter: blur(12px);
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.5);
    }

    /* Pulsing Mood Borders */
    .card.mood-focused { border-color: rgba(52, 211, 153, 0.4); box-shadow: 0 0 15px rgba(52, 211, 153, 0.15); }
    .card.mood-busy { border-color: rgba(251, 191, 36, 0.4); box-shadow: 0 0 15px rgba(251, 191, 36, 0.15); }
    .card.mood-idle { border-color: rgba(96, 165, 250, 0.4); box-shadow: 0 0 15px rgba(96, 165, 250, 0.15); }
    .card.mood-alert { border-color: rgba(248, 113, 113, 0.4); box-shadow: 0 0 15px rgba(248, 113, 113, 0.15); }

    .mood-ring {
      position: absolute;
      top: 1rem;
      right: 1rem;
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    .mood-focused .mood-ring { background-color: #10b981; box-shadow: 0 0 8px #10b981; animation: pulse 2s infinite; }
    .mood-busy .mood-ring { background-color: #f59e0b; box-shadow: 0 0 8px #f59e0b; animation: pulse 2s infinite; }
    .mood-idle .mood-ring { background-color: #3b82f6; box-shadow: 0 0 8px #3b82f6; animation: pulse 2s infinite; }
    .mood-alert .mood-ring { background-color: #ef4444; box-shadow: 0 0 8px #ef4444; animation: pulse 1s infinite; }
    .mood-offline .mood-ring { background-color: #6b7280; }

    @keyframes pulse {
      0% { transform: scale(0.95); opacity: 0.5; }
      50% { transform: scale(1.1); opacity: 1; }
      100% { transform: scale(0.95); opacity: 0.5; }
    }

    .card-header {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .card-name {
      font-size: 1.25rem;
      font-weight: 700;
      color: #fff;
    }

    .card-id {
      font-size: 0.8rem;
      color: var(--text-muted, #9ca3af);
      font-family: monospace;
    }

    /* Telemetry Grid */
    .telemetry-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      background: rgba(255, 255, 255, 0.03);
      padding: 0.75rem;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .telemetry-item {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .telemetry-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #9ca3af;
    }

    .telemetry-value {
      font-size: 0.9rem;
      font-weight: 600;
      color: #e5e7eb;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .badge-focused { background: rgba(16, 185, 129, 0.15); color: #34d399; }
    .badge-busy { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
    .badge-idle { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
    .badge-alert { background: rgba(239, 68, 68, 0.15); color: #f87171; }
    .badge-offline { background: rgba(107, 114, 128, 0.15); color: #9ca3af; }

    .card-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: auto;
      padding-top: 0.75rem;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }

    /* Modal / Configuration Side-Panel */
    .side-panel {
      position: fixed;
      top: 0;
      right: 0;
      width: 500px;
      height: 100vh;
      background: #111118;
      border-left: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5);
      z-index: 150;
      display: flex;
      flex-direction: column;
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .side-panel.open {
      transform: translateX(0);
    }

    .panel-header {
      padding: 1.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .panel-tabs {
      display: flex;
      background: rgba(255, 255, 255, 0.02);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding: 0 1rem;
    }

    .tab-btn {
      padding: 0.75rem 1rem;
      background: none;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
    }

    .tab-btn.active {
      color: #a78bfa;
      border-bottom-color: #a78bfa;
    }

    .panel-content {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .panel-footer {
      padding: 1rem 1.5rem;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.01);
      display: flex;
      gap: 0.75rem;
    }

    /* Create Wizard Styles */
    .wizard-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      z-index: 200;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .wizard-box {
      width: 550px;
      background: #111118;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 2rem;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .wizard-progress {
      display: flex;
      justify-content: space-between;
      position: relative;
      margin-bottom: 1rem;
    }

    .wizard-progress::before {
      content: "";
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      height: 2px;
      background: rgba(255, 255, 255, 0.08);
      z-index: 1;
    }

    .wizard-step-indicator {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #1e1e28;
      border: 2px solid rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      z-index: 2;
      transition: all 0.3s;
    }

    .wizard-step-indicator.active {
      background: #a78bfa;
      border-color: #a78bfa;
      box-shadow: 0 0 10px rgba(167, 139, 250, 0.5);
    }

    .wizard-step-indicator.completed {
      background: #10b981;
      border-color: #10b981;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    label {
      font-size: 0.8rem;
      font-weight: 600;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    input, select, textarea {
      background: #181824;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      color: #fff;
      padding: 0.6rem 0.8rem;
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.2s;
    }

    input:focus, select:focus, textarea:focus {
      border-color: #a78bfa;
    }

    /* Tools check grid */
    .tools-check-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
      background: #181824;
      padding: 1rem;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      max-height: 200px;
      overflow-y: auto;
    }

    .tool-check-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
    }

    .btn {
      background: #1e1e28;
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #e5e7eb;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.85rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: all 0.2s;
    }

    .btn:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.15);
    }

    .btn-primary {
      background: linear-gradient(135deg, #a78bfa 0%, #ec4899 100%);
      border: none;
      color: #fff;
    }

    .btn-primary:hover {
      opacity: 0.9;
    }

    .btn-danger {
      color: #f87171;
      border-color: rgba(239, 68, 68, 0.2);
    }

    .btn-danger:hover {
      background: rgba(239, 68, 68, 0.1);
    }

    code {
      font-family: monospace;
      background: rgba(0, 0, 0, 0.2);
      padding: 0.15rem 0.3rem;
      border-radius: 4px;
      color: #f472b6;
    }

    .memory-viewer {
      background: #09090d;
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 1rem;
      font-family: monospace;
      font-size: 0.8rem;
      color: #34d399;
      height: 300px;
      overflow-y: auto;
      white-space: pre-wrap;
    }
  `}connectedCallback(){super.connectedCallback(),this.wsClient.addStatusListener(e=>{e===`connected`&&(this.loadConfig(),this.startStatsPolling())})}disconnectedCallback(){super.disconnectedCallback(),this.statsInterval&&clearInterval(this.statsInterval)}startStatsPolling(){this.statsInterval&&clearInterval(this.statsInterval),this.pollStats(),this.statsInterval=setInterval(()=>this.pollStats(),5e3)}async pollStats(){try{let e={};for(let t of this.agents)try{let n=await this.wsClient.send(`getAgentStats`,{agentId:t.id});e[t.id]=n}catch{}this.agentStats=e;let t=await this.wsClient.send(`getSystemIntelligence`);this.agentIntelligence=t.agents||{}}catch{}}async curateAgentSkills(e){this.curatingAgentId=e,this.curateStatusMsg=``;try{let t=await this.wsClient.send(`curateAgentSkills`,{agentId:e});this.curateStatusMsg=`✓ ${t.message||`Done`}`,setTimeout(()=>this.pollStats(),2e3)}catch(e){this.curateStatusMsg=`✗ ${e.message||`Failed`}`}finally{this.curatingAgentId=null,setTimeout(()=>{this.curateStatusMsg=``},5e3)}}computeIQ(e){if(!e)return 0;let t=(e.skillSuccessRate??0)*50,n=Math.min(e.totalTurns??0,500)/500*20,r=Math.min(e.learnedSkillCount??0,20)/20*15,i=Math.min(e.memorySizeKb??0,64)/64*15;return Math.min(100,Math.round(t+n+r+i))}async loadConfig(){try{let e=await this.wsClient.send(`getSystemConfig`);if(this.config=e.config,this.baseHash=e.hash,this.agents=this.config.agents||[],this.providers=[],this.models=[],this.config.models&&this.config.models.providers){let e=this.config.models.providers;for(let[t,n]of Object.entries(e)){let e=n;this.providers.find(e=>e.id===t)||this.providers.push({id:t,name:e.name||t});let r=e.models||[];for(let e of r){let n=typeof e==`string`?e:e.id;this.models.find(e=>e.id===n&&e.provider===t)||this.models.push({id:n,name:typeof e==`string`?e:e.name||e.id,provider:t})}}}if(this.config.providers){if(Array.isArray(this.config.providers))this.config.providers.forEach(e=>{e&&e.id&&!this.providers.find(t=>t.id===e.id)&&this.providers.push({id:e.id,name:e.name||e.id})});else if(typeof this.config.providers==`object`)for(let[e,t]of Object.entries(this.config.providers))this.providers.find(t=>t.id===e)||this.providers.push({id:e,name:t.name||e})}if(this.config.models&&Array.isArray(this.config.models)&&this.config.models.forEach(e=>{if(e&&e.id){let t=e.provider||this.providers[0]?.id||``;this.models.find(n=>n.id===e.id&&n.provider===t)||this.models.push({id:e.id,name:e.name||e.id,provider:t})}}),this.providers.length>0&&!this.agentProv){this.agentProv=this.providers[0].id;let e=this.models.find(e=>e.provider===this.agentProv);this.agentModel=e?e.id:``}}catch(e){console.error(`[AgentsManager] Failed to load config:`,e)}}async saveConfig(){let e={...this.config,agents:this.agents};try{let t=await this.wsClient.send(`saveSystemConfig`,{config:e,baseHash:this.baseHash});t.success?(this.baseHash=t.hash,this.pollStats()):alert(`Failed to save changes.`)}catch(e){console.error(`[AgentsManager] Failed to save config:`,e)}}getTelegramBot(e){return this.config?.telegram?.bots&&this.config.telegram.bots.find(t=>t.agentId===e)||null}handleProviderChange(e){this.agentProv=e.target.value;let t=this.models.find(e=>e.provider===this.agentProv);this.agentModel=t?t.id:``}async restartAgent(e){try{await this.wsClient.send(`restartAgent`,{agentId:e}),alert(`Agent '${e}' restart request sent.`),this.pollStats()}catch{}}async restartGateway(){if(confirm(`Are you sure you want to restart the Gateway daemon?`))try{await this.wsClient.send(`restartGateway`),alert(`Gateway restarting...`)}catch{}}openWizard(){this.agentId=``,this.agentName=``,this.agentWorkspace=``,this.agentProv=this.providers[0]?.id||``,this.agentModel=this.models.find(e=>e.provider===this.agentProv)?.id||``,this.agentTemp=.4,this.agentMaxTokens=4096,this.agentSandbox=`none`,this.agentTools=[`read_file`,`write_file`,`edit_file`,`list_dir`,`think`],this.agentBotToken=``,this.agentBotAllowedUsers=``,this.allowUnrestrictedCommands=!1,this.allowSelfImprovement=!1,this.agentApiKey=``,this.wizardStep=1,this.isWizardOpen=!0}wizardNext(){if(this.wizardStep===1&&(!this.agentId||!this.agentName)){alert(`Please provide an ID and display name.`);return}this.wizardStep===1&&(this.agentWorkspace=`/home/rohith/.komorebi/agents/${this.agentId}`),this.wizardStep++}wizardPrev(){this.wizardStep--}finishWizard(){let e=this.agentApiKey.trim();if(!e){let t=this.config.models?.providers?.[this.agentProv]?.apiKey||``;e=t&&!t.startsWith(`$`)&&t!==`mock-key`&&t!==`dummy`?`\${${t}}`:t||`\${${this.agentProv.toUpperCase()}_API_KEY}`}let t={id:this.agentId,name:this.agentName,workspace:this.agentWorkspace,model:{provider:this.agentProv,name:this.agentModel,apiKey:e,temperature:this.agentTemp,maxOutputTokens:this.agentMaxTokens},toolPolicy:{sandboxType:this.agentSandbox,allowedTools:this.agentTools,networkAccess:!0,allowUnrestrictedCommands:this.allowUnrestrictedCommands,allowSelfImprovement:this.allowSelfImprovement},tools:this.agentTools};if(this.agents.find(e=>e.id===this.agentId)){alert(`Agent with this ID already exists.`);return}this.agents=[...this.agents,t],this.agentBotToken&&(this.config.telegram||(this.config.telegram={bots:[]}),this.config.telegram.bots||(this.config.telegram.bots=[]),this.config.telegram.bots.push({token:this.agentBotToken,agentId:this.agentId,allowedUserIds:this.agentBotAllowedUsers?this.agentBotAllowedUsers.split(`,`).map(e=>parseInt(e.trim(),10)).filter(Number.isInteger):[]})),this.isWizardOpen=!1,this.saveConfig()}async openConfigPanel(e){this.agentId=e.id,this.agentName=e.name,this.agentWorkspace=e.workspace||``,this.agentProv=e.model?.provider||this.providers[0]?.id||``,this.agentModel=e.model?.name||this.models.find(e=>e.provider===this.agentProv)?.id||``,this.agentTemp=e.model?.temperature??.4,this.agentMaxTokens=e.model?.maxOutputTokens||4096,this.agentSandbox=e.toolPolicy?.sandboxType||`none`,this.agentTools=e.tools||e.toolPolicy?.allowedTools||[],this.allowUnrestrictedCommands=e.toolPolicy?.allowUnrestrictedCommands??!1,this.allowSelfImprovement=e.toolPolicy?.allowSelfImprovement??!1,this.agentApiKey=e.model?.apiKey||``;let t=this.getTelegramBot(e.id);this.agentBotToken=t?t.token:``,this.agentBotAllowedUsers=t?(t.allowedUserIds||[]).join(`, `):``,this.activeTab=`identity`,this.isConfigPanelOpen=!0,this.inlineMemoryContent=`Loading memory.md...`;try{let t=await this.wsClient.send(`readAgentFile`,{agentId:e.id,filename:`memory.md`});this.inlineMemoryContent=t.content||`Empty memory file.`}catch{this.inlineMemoryContent=`No memory.md file initialized yet.`}}saveConfigPanel(){let e=this.agentApiKey.trim();if(!e){let t=this.config.models?.providers?.[this.agentProv]?.apiKey||``;e=t&&!t.startsWith(`$`)&&t!==`mock-key`&&t!==`dummy`?`\${${t}}`:t||`\${${this.agentProv.toUpperCase()}_API_KEY}`}let t={id:this.agentId,name:this.agentName,workspace:this.agentWorkspace,model:{provider:this.agentProv,name:this.agentModel,apiKey:e,temperature:this.agentTemp,maxOutputTokens:this.agentMaxTokens},toolPolicy:{sandboxType:this.agentSandbox,allowedTools:this.agentTools,networkAccess:!0,allowUnrestrictedCommands:this.allowUnrestrictedCommands,allowSelfImprovement:this.allowSelfImprovement},tools:this.agentTools};if(this.agents=this.agents.map(e=>e.id===this.agentId?t:e),this.agentBotToken){this.config.telegram||(this.config.telegram={bots:[]}),this.config.telegram.bots||(this.config.telegram.bots=[]);let e={token:this.agentBotToken,agentId:this.agentId,allowedUserIds:this.agentBotAllowedUsers?this.agentBotAllowedUsers.split(`,`).map(e=>parseInt(e.trim(),10)).filter(Number.isInteger):[]},t=this.config.telegram.bots.findIndex(e=>e.agentId===this.agentId);t>-1?this.config.telegram.bots[t]=e:this.config.telegram.bots.push(e)}else this.config.telegram?.bots&&(this.config.telegram.bots=this.config.telegram.bots.filter(e=>e.agentId!==this.agentId));this.isConfigPanelOpen=!1,this.saveConfig()}deleteAgent(e){confirm(`Are you sure you want to delete agent ${e}?`)&&(this.agents=this.agents.filter(t=>t.id!==e),this.config.telegram?.bots&&(this.config.telegram.bots=this.config.telegram.bots.filter(t=>t.agentId!==e)),this.saveConfig())}handleToolToggle(e,t){t?this.agentTools.includes(e)||(this.agentTools=[...this.agentTools,e]):this.agentTools=this.agentTools.filter(t=>t!==e)}render(){return S`
      <div class="title-row">
        <div class="title">Agent Fleet Coordinator</div>
        <div style="display: flex; gap: 0.5rem">
          <button class="btn btn-primary" @click=${this.openWizard}>➕ Create Agent</button>
          <button class="btn btn-danger" @click=${this.restartGateway}>🔄 Restart Gateway</button>
        </div>
      </div>

      <div class="list-grid">
        ${this.agents.map(e=>{let t=this.agentStats[e.id]||{status:`offline`,ramUsageMb:0,cpuPercent:0,uptimeMs:0,mood:`offline`,turnCount:0},n=`mood-${t.mood||`offline`}`,r=t.status===`running`;return S`
            <div class="card ${n}">
              <div class="mood-ring"></div>
              <div class="card-header">
                <div class="card-name">${e.name}</div>
                <div class="card-id">ID: ${e.id}</div>
              </div>

              <div class="telemetry-grid">
                <div class="telemetry-item">
                  <span class="telemetry-label">Status</span>
                  <span class="telemetry-value">
                    <span class="badge badge-${t.status===`running`?t.mood||`focused`:`offline`}">
                      ${t.status===`running`?(t.mood||`focused`).toUpperCase():`OFFLINE`}
                    </span>
                  </span>
                </div>
                <div class="telemetry-item">
                  <span class="telemetry-label">Model</span>
                  <span class="telemetry-value" style="font-family: monospace; font-size: 0.75rem">${e.model?.name||`None`}</span>
                </div>
                <div class="telemetry-item">
                  <span class="telemetry-label">RAM Usage</span>
                  <span class="telemetry-value">${r?`${t.ramUsageMb} MB`:`—`}</span>
                </div>
                <div class="telemetry-item">
                  <span class="telemetry-label">CPU Load</span>
                  <span class="telemetry-value">${r?`${t.cpuPercent}%`:`—`}</span>
                </div>
                <div class="telemetry-item">
                  <span class="telemetry-label">Uptime</span>
                  <span class="telemetry-value">${r?`${Math.round(t.uptimeMs/6e4)}m`:`—`}</span>
                </div>
                <div class="telemetry-item">
                  <span class="telemetry-label">Turns Run</span>
                  <span class="telemetry-value">${r?t.turnCount:`—`}</span>
                </div>
                <div class="telemetry-item" style="grid-column: 1 / -1">
                  ${(()=>{let t=this.agentIntelligence[e.id]||{},n=this.computeIQ(t),r=n>=75?`#34d399`:n>=45?`#fbbf24`:`#f87171`;return S`
                      <div style="display:flex; align-items:center; gap:0.75rem">
                        <span class="telemetry-label">IQ Score</span>
                        <div style="flex:1; height:4px; background:rgba(255,255,255,0.06); border-radius:99px; overflow:hidden">
                          <div style="height:100%; width:${n}%; background:${r}; border-radius:99px; transition: width 0.8s"></div>
                        </div>
                        <span style="font-size:0.8rem; font-weight:800; color:${r}">${n}</span>
                        <span style="font-size:0.7rem; color:#6b7280">${t.learnedSkillCount??0} learned</span>
                      </div>
                    `})()}
                </div>
                ${t.latestThoughts?S`
                  <div style="grid-column: 1 / -1; margin-top: 0.5rem; background: rgba(0,0,0,0.12); border: 1px solid rgba(255,255,255,0.03); padding: 0.6rem 0.8rem; border-radius: 8px;">
                    <div style="font-size: 0.68rem; text-transform: uppercase; color: var(--accent-secondary); font-weight: 700; letter-spacing: 0.5px; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.25rem">
                      <span>🧠</span> Latest Thought
                    </div>
                    <div style="font-size: 0.76rem; color: #cbd5e1; font-family: var(--font-mono, monospace); line-height: 1.3">
                      "${t.latestThoughts}"
                    </div>
                  </div>
                `:``}
              </div>

              <div class="card-actions">
                <button class="btn" @click=${()=>this.openConfigPanel(e)}>⚙️ Configure</button>
                <button class="btn btn-primary" ?disabled=${!r} @click=${()=>this.restartAgent(e.id)}>🔄 Restart</button>
                <button class="btn btn-danger" @click=${()=>this.deleteAgent(e.id)}>✕ Delete</button>
              </div>
            </div>
          `})}
      </div>

      <!-- Create Agent Wizard -->
      ${this.isWizardOpen?S`
        <div class="wizard-overlay">
          <div class="wizard-box">
            <h2 style="margin: 0; background: linear-gradient(135deg, #a78bfa 0%, #ec4899 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
              Agent Creator Wizard
            </h2>
            
            <div class="wizard-progress">
              <div class="wizard-step-indicator ${this.wizardStep>=1?`active`:``}">1</div>
              <div class="wizard-step-indicator ${this.wizardStep>=2?`active`:``}">2</div>
              <div class="wizard-step-indicator ${this.wizardStep>=3?`active`:``}">3</div>
            </div>

            ${this.wizardStep===1?S`
              <div class="form-group">
                <label>Agent Identifier (Process ID)</label>
                <input type="text" placeholder="e.g. coder-agent" .value=${this.agentId} @input=${e=>this.agentId=e.target.value}/>
              </div>
              <div class="form-group">
                <label>Display / Persona Name</label>
                <input type="text" placeholder="e.g. Code Architect" .value=${this.agentName} @input=${e=>this.agentName=e.target.value}/>
              </div>
            `:``}

            ${this.wizardStep===2?S`
              <div class="form-group">
                <label>Provider</label>
                <select .value=${this.agentProv} @change=${this.handleProviderChange}>
                  ${this.providers.map(e=>S`<option value=${e.id}>${e.name}</option>`)}
                </select>
              </div>
              <div class="form-group">
                <label>Model Name</label>
                ${this.models.filter(e=>e.provider===this.agentProv).length>0?S`
                  <select .value=${this.agentModel} @change=${e=>this.agentModel=e.target.value}>
                    ${this.models.filter(e=>e.provider===this.agentProv).map(e=>S`<option value=${e.id}>${e.name}</option>`)}
                    <option value="custom">-- Custom Model --</option>
                  </select>
                `:``}
                ${this.models.filter(e=>e.provider===this.agentProv).length===0||this.agentModel===`custom`?S`
                  <input 
                    type="text" 
                    placeholder="Enter custom model name (e.g. gpt-4o)" 
                    .value=${this.agentModel===`custom`?``:this.agentModel} 
                    @input=${e=>this.agentModel=e.target.value}
                    style="margin-top: 0.5rem"
                  />
                `:``}
              </div>
              <div class="form-group">
                <label>Custom API Key (Optional)</label>
                <input 
                  type="password" 
                  placeholder="e.g. sk-... (leave empty to use global provider key)" 
                  .value=${this.agentApiKey} 
                  @input=${e=>this.agentApiKey=e.target.value}
                />
              </div>
              <div class="form-group">
                <label>System Sandbox Isolation</label>
                <select .value=${this.agentSandbox} @change=${e=>this.agentSandbox=e.target.value}>
                  <option value="none">none (Unjail / Host OS)</option>
                  <option value="bubblewrap">bubblewrap (Sandboxed FS)</option>
                </select>
              </div>
            `:``}

            ${this.wizardStep===3?S`
              <div class="form-group">
                <label>Telegram Bot Token (Optional)</label>
                <input type="password" placeholder="e.g. 123456:AAFFGG..." .value=${this.agentBotToken} @input=${e=>this.agentBotToken=e.target.value}/>
              </div>
              <div class="form-group">
                <label>Allowed Telegram Chat IDs (Comma-separated)</label>
                <input type="text" placeholder="e.g. 987654321" .value=${this.agentBotAllowedUsers} @input=${e=>this.agentBotAllowedUsers=e.target.value}/>
              </div>
            `:``}

            <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem">
              ${this.wizardStep>1?S`<button class="btn" @click=${this.wizardPrev}>Back</button>`:``}
              ${this.wizardStep<3?S`<button class="btn btn-primary" @click=${this.wizardNext}>Next</button>`:S`<button class="btn btn-primary" @click=${this.finishWizard}>Create Agent</button>`}
              <button class="btn" @click=${()=>this.isWizardOpen=!1}>Cancel</button>
            </div>
          </div>
        </div>
      `:``}

      <!-- Slide-Out Configuration & Persona Panel -->
      <div class="side-panel ${this.isConfigPanelOpen?`open`:``}">
        <div class="panel-header">
          <h2 style="margin:0; font-size:1.4rem">${this.agentName} Config</h2>
          <button class="btn" @click=${()=>this.isConfigPanelOpen=!1}>✕</button>
        </div>

        <div class="panel-tabs">
          <button class="tab-btn ${this.activeTab===`identity`?`active`:``}" @click=${()=>this.activeTab=`identity`}>Identity</button>
          <button class="tab-btn ${this.activeTab===`model`?`active`:``}" @click=${()=>this.activeTab=`model`}>Model</button>
          <button class="tab-btn ${this.activeTab===`tools`?`active`:``}" @click=${()=>this.activeTab=`tools`}>Tools</button>
          <button class="tab-btn ${this.activeTab===`telegram`?`active`:``}" @click=${()=>this.activeTab=`telegram`}>Telegram</button>
          <button class="tab-btn ${this.activeTab===`memory`?`active`:``}" @click=${()=>this.activeTab=`memory`}>Memory</button>
        </div>

        <div class="panel-content">
          ${this.activeTab===`identity`?S`
            <div class="form-group">
              <label>Agent Name</label>
              <input type="text" .value=${this.agentName} @input=${e=>this.agentName=e.target.value}/>
            </div>
            <div class="form-group">
              <label>Workspace Path</label>
              <input type="text" .value=${this.agentWorkspace} @input=${e=>this.agentWorkspace=e.target.value}/>
            </div>
          `:``}

          ${this.activeTab===`model`?S`
            <div class="form-group">
              <label>Provider</label>
              <select .value=${this.agentProv} @change=${this.handleProviderChange}>
                ${this.providers.map(e=>S`<option value=${e.id}>${e.name}</option>`)}
              </select>
            </div>
            <div class="form-group">
              <label>Model Name</label>
              ${this.models.filter(e=>e.provider===this.agentProv).length>0?S`
                <select .value=${this.agentModel} @change=${e=>this.agentModel=e.target.value}>
                  ${this.models.filter(e=>e.provider===this.agentProv).map(e=>S`<option value=${e.id}>${e.name}</option>`)}
                  <option value="custom">-- Custom Model --</option>
                </select>
              `:``}
              ${this.models.filter(e=>e.provider===this.agentProv).length===0||this.agentModel===`custom`?S`
                <input 
                  type="text" 
                  placeholder="Enter custom model name (e.g. gpt-4o)" 
                  .value=${this.agentModel===`custom`?``:this.agentModel} 
                  @input=${e=>this.agentModel=e.target.value}
                  style="margin-top: 0.5rem"
                />
              `:``}
            </div>
            <div class="form-group">
              <label>Custom API Key (Optional)</label>
              <input 
                type="password" 
                placeholder="e.g. sk-... (leave empty to use global provider key)" 
                .value=${this.agentApiKey} 
                @input=${e=>this.agentApiKey=e.target.value}
              />
            </div>
            <div class="form-group">
              <label>Temperature (${this.agentTemp})</label>
              <input type="range" min="0" max="1" step="0.05" .value=${this.agentTemp} @input=${e=>this.agentTemp=parseFloat(e.target.value)}/>
            </div>
          `:``}

          ${this.activeTab===`tools`?S`
            <div class="form-group">
              <label>Allowed Tools Checklist</label>
              <div class="tools-check-grid" style="max-height: none">
                ${this.availableTools.map(e=>S`
                  <div class="tool-check-item">
                    <input type="checkbox" .checked=${this.agentTools.includes(e.name)} @change=${t=>this.handleToolToggle(e.name,t.target.checked)}/>
                    <span><code>${e.name}</code></span>
                  </div>
                `)}
              </div>
            </div>
            <div class="form-group">
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin-top: 1rem;">
                <input type="checkbox" .checked=${this.allowUnrestrictedCommands} @change=${e=>this.allowUnrestrictedCommands=e.target.checked} style="width: auto;"/>
                <span>Bypass Telegram command approvals</span>
              </label>
            </div>
            <div class="form-group">
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin-top: 0.5rem;">
                <input type="checkbox" .checked=${this.allowSelfImprovement} @change=${e=>this.allowSelfImprovement=e.target.checked} style="width: auto;"/>
                <span>Allow Self-Improvement & Code Modifications</span>
              </label>
            </div>
          `:``}

          ${this.activeTab===`telegram`?S`
            <div class="form-group">
              <label>Bot Token</label>
              <input type="password" placeholder="Token" .value=${this.agentBotToken} @input=${e=>this.agentBotToken=e.target.value}/>
            </div>
            <div class="form-group">
              <label>Allowed User IDs</label>
              <input type="text" placeholder="Allowed IDs" .value=${this.agentBotAllowedUsers} @input=${e=>this.agentBotAllowedUsers=e.target.value}/>
            </div>
          `:``}

          ${this.activeTab===`memory`?S`
            <div class="form-group">
              <label>MEMORY.md contents</label>
              <div class="memory-viewer">${this.inlineMemoryContent}</div>
            </div>
            <div style="display:flex; align-items:center; gap:0.75rem; margin-top:0.75rem; padding-top:0.75rem; border-top:1px solid rgba(255,255,255,0.06)">
              <button
                class="btn btn-primary"
                style="flex:1"
                @click=${()=>this.curateAgentSkills(this.agentId)}
                ?disabled=${this.curatingAgentId===this.agentId}
              >
                ${this.curatingAgentId===this.agentId?`⏳ Curating Skills...`:`✨ Curate Skills Now`}
              </button>
              ${this.curateStatusMsg?S`<span style="font-size:0.8rem;color:#34d399">${this.curateStatusMsg}</span>`:``}
            </div>
          `:``}
        </div>

        <div class="panel-footer">
          <button class="btn btn-primary" style="flex:1" @click=${this.saveConfigPanel}>Save Changes</button>
          <button class="btn" @click=${()=>this.isConfigPanelOpen=!1}>Cancel</button>
        </div>
      </div>
    `}};e([A()],U.prototype,`config`,void 0),e([A()],U.prototype,`baseHash`,void 0),e([A()],U.prototype,`agents`,void 0),e([A()],U.prototype,`providers`,void 0),e([A()],U.prototype,`models`,void 0),e([A()],U.prototype,`agentStats`,void 0),e([A()],U.prototype,`agentIntelligence`,void 0),e([A()],U.prototype,`curatingAgentId`,void 0),e([A()],U.prototype,`curateStatusMsg`,void 0),e([A()],U.prototype,`isWizardOpen`,void 0),e([A()],U.prototype,`wizardStep`,void 0),e([A()],U.prototype,`isConfigPanelOpen`,void 0),e([A()],U.prototype,`activeTab`,void 0),e([A()],U.prototype,`inlineMemoryContent`,void 0),e([A()],U.prototype,`agentId`,void 0),e([A()],U.prototype,`agentName`,void 0),e([A()],U.prototype,`agentWorkspace`,void 0),e([A()],U.prototype,`agentProv`,void 0),e([A()],U.prototype,`agentModel`,void 0),e([A()],U.prototype,`agentTemp`,void 0),e([A()],U.prototype,`agentMaxTokens`,void 0),e([A()],U.prototype,`agentSandbox`,void 0),e([A()],U.prototype,`agentTools`,void 0),e([A()],U.prototype,`agentBotToken`,void 0),e([A()],U.prototype,`agentBotAllowedUsers`,void 0),e([A()],U.prototype,`allowUnrestrictedCommands`,void 0),e([A()],U.prototype,`allowSelfImprovement`,void 0),e([A()],U.prototype,`agentApiKey`,void 0),U=e([k(`agents-manager`)],U);var W=class extends O{constructor(...e){super(...e),this.config=null,this.baseHash=``,this.teams=[],this.agents=[],this.isFormOpen=!1,this.formMode=`add`,this.teamId=``,this.teamName=``,this.leaderAgentId=``,this.memberAgentIds=[],this.wsClient=j.getInstance()}static{this.styles=s`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .title {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .list-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1rem;
    }

    .card {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }

    .card-title-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.5rem;
    }

    .card-name {
      font-family: var(--font-display);
      font-weight: 600;
      font-size: 1.1rem;
      color: var(--text-primary);
    }

    .card-id {
      font-size: 0.8rem;
      color: var(--text-muted);
      font-family: var(--font-mono);
    }

    .card-section-title {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--accent-secondary);
      margin-top: 0.25rem;
    }

    .card-details {
      font-size: 0.85rem;
      color: var(--text-secondary);
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .card-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: auto;
      padding-top: 0.75rem;
      border-top: 1px solid var(--border-color);
    }

    /* Modal styles */
    .overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      z-index: 100;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .modal-box {
      width: 500px;
      max-height: 85vh;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      gap: 1rem;
      overflow-y: auto;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-secondary);
    }

    input, select {
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      padding: 0.5rem 0.6rem;
      outline: none;
      font-size: 0.9rem;
    }

    /* Members checkbox grid */
    .members-check-grid {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      background-color: var(--bg-primary);
      padding: 0.75rem;
      border-radius: 6px;
      border: 1px solid var(--border-color);
      max-height: 150px;
      overflow-y: auto;
    }

    .member-check-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
    }

    .btn {
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 0.45rem 0.9rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      font-size: 0.85rem;
      transition: all 0.2s;
    }

    .btn:hover {
      background-color: var(--border-color);
    }

    .btn-primary {
      background-color: var(--accent-primary);
      border-color: var(--accent-primary);
    }

    .btn-danger {
      color: var(--status-red);
      border-color: rgba(255, 51, 102, 0.3);
    }

    .btn-danger:hover {
      background-color: var(--status-red-glow);
    }

    code {
      font-family: var(--font-mono);
      font-size: 0.8rem;
      background-color: var(--bg-primary);
      padding: 0.15rem 0.3rem;
      border-radius: 4px;
      color: var(--accent-secondary);
    }
  `}connectedCallback(){super.connectedCallback(),this.loadConfig()}async loadConfig(){try{let e=await this.wsClient.send(`getSystemConfig`);this.config=e.config,this.baseHash=e.hash,this.agents=this.config.agents||[],this.teams=this.config.teams||[]}catch(e){console.error(`[TeamsManager] Failed to load configurations:`,e)}}async saveConfig(){let e={...this.config,teams:this.teams};try{let t=await this.wsClient.send(`saveSystemConfig`,{config:e,baseHash:this.baseHash});t.success?(this.baseHash=t.hash,alert(`Teams configuration updated successfully.`)):alert(`Failed to save changes.`)}catch(e){console.error(`[TeamsManager] Failed to save config:`,e)}}openAddTeam(){this.formMode=`add`,this.teamId=``,this.teamName=``,this.leaderAgentId=``,this.memberAgentIds=[],this.isFormOpen=!0}openEditTeam(e){this.formMode=`edit`,this.teamId=e.id,this.teamName=e.name,this.leaderAgentId=e.leaderAgentId||``,this.memberAgentIds=[...e.memberAgentIds],this.isFormOpen=!0}deleteTeam(e){confirm(`Are you sure you want to completely delete team ${e}?`)&&(this.teams=this.teams.filter(t=>t.id!==e),this.saveConfig())}handleMemberToggle(e,t){t?this.memberAgentIds.includes(e)||(this.memberAgentIds=[...this.memberAgentIds,e]):this.memberAgentIds=this.memberAgentIds.filter(t=>t!==e)}saveTeamForm(){if(!this.teamId||!this.teamName){alert(`Team ID and Team Name are required.`);return}let e={id:this.teamId,name:this.teamName,leaderAgentId:this.leaderAgentId||void 0,memberAgentIds:this.memberAgentIds};if(this.formMode===`add`){if(this.teams.find(e=>e.id===this.teamId)){alert(`A team with this ID already exists.`);return}this.teams=[...this.teams,e]}else this.teams=this.teams.map(t=>t.id===this.teamId?e:t);this.isFormOpen=!1,this.saveConfig()}getAgentName(e){let t=this.agents.find(t=>t.id===e);return t?t.name:e}render(){return S`
      <div class="title-row">
        <div class="title">Teams Registry</div>
        <button class="btn btn-primary" @click=${this.openAddTeam}>➕ Create Team</button>
      </div>

      <div class="list-grid">
        ${this.teams.length===0?S`
          <div style="grid-column: span 3; text-align: center; color: var(--text-muted); padding: 3rem">
            No teams configured yet. Click "Create Team" to group your agents together!
          </div>
        `:this.teams.map(e=>S`
          <div class="card">
            <div class="card-title-row">
              <div>
                <div class="card-name">${e.name}</div>
                <div class="card-id">ID: ${e.id}</div>
              </div>
            </div>
            
            <div class="card-section-title">👑 Team Leader</div>
            <div class="card-details">
              ${e.leaderAgentId?S`
                <div>${this.getAgentName(e.leaderAgentId)} <code>${e.leaderAgentId}</code></div>
              `:S`
                <div style="color: var(--text-muted); font-style: italic">No leader assigned</div>
              `}
            </div>

            <div class="card-section-title">🤖 Members (${e.memberAgentIds.length})</div>
            <div class="card-details" style="max-height: 80px; overflow-y: auto; gap: 0.15rem">
              ${e.memberAgentIds.length===0?S`
                <div style="color: var(--text-muted); font-style: italic">No member agents added</div>
              `:e.memberAgentIds.map(e=>S`
                <div>• ${this.getAgentName(e)} <code>${e}</code></div>
              `)}
            </div>

            <div class="card-actions">
              <button class="btn" @click=${()=>this.openEditTeam(e)}>⚙️ Edit Settings</button>
              <button class="btn btn-danger" @click=${()=>this.deleteTeam(e.id)}>✕ Delete</button>
            </div>
          </div>
        `)}
      </div>

      <!-- Add/Edit Overlay Form -->
      ${this.isFormOpen?S`
        <div class="overlay" @click=${()=>this.isFormOpen=!1}>
          <div class="modal-box" @click=${e=>e.stopPropagation()}>
            <h3 style="font-family: var(--font-display); margin-top: 0">
              ${this.formMode===`add`?`Create New`:`Configure`} Team
            </h3>

            <div style="display: flex; flex-direction: column; gap: 1rem">
              <div class="form-group">
                <label for="teamId">Team ID</label>
                <input 
                  type="text" 
                  id="teamId" 
                  placeholder="e.g. backend-crew" 
                  .value=${this.teamId}
                  @input=${e=>this.teamId=e.target.value}
                  ?disabled=${this.formMode===`edit`}
                />
              </div>

              <div class="form-group">
                <label for="teamName">Team Name</label>
                <input 
                  type="text" 
                  id="teamName" 
                  placeholder="e.g. Backend Engineering Crew" 
                  .value=${this.teamName}
                  @input=${e=>this.teamName=e.target.value}
                />
              </div>

              <div class="form-group">
                <label for="teamLeader">Team Leader (Optional)</label>
                <select id="teamLeader" .value=${this.leaderAgentId} @change=${e=>this.leaderAgentId=e.target.value}>
                  <option value="">None</option>
                  ${this.agents.map(e=>S`
                    <option value=${e.id}>${e.name||e.id}</option>
                  `)}
                </select>
              </div>

              <div class="form-group">
                <label>Select Team Members</label>
                <div class="members-check-grid">
                  ${this.agents.length===0?S`
                    <div style="color: var(--text-muted); font-size: 0.8rem; font-style: italic">No agents created to select from</div>
                  `:this.agents.map(e=>S`
                      <div class="member-check-item">
                        <input 
                          type="checkbox" 
                          .checked=${this.memberAgentIds.includes(e.id)}
                          @change=${t=>this.handleMemberToggle(e.id,t.target.checked)}
                          style="width: auto; cursor: pointer"
                        />
                        <span>${e.name||e.id} <code>${e.id}</code></span>
                      </div>
                    `)}
                </div>
              </div>
            </div>

            <div style="display: flex; gap: 0.5rem; margin-top: 1rem">
              <button class="btn btn-primary" style="flex: 1" @click=${this.saveTeamForm}>
                💾 Save Team
              </button>
              <button class="btn" @click=${()=>this.isFormOpen=!1}>Cancel</button>
            </div>
          </div>
        </div>
      `:``}
    `}};e([A()],W.prototype,`config`,void 0),e([A()],W.prototype,`baseHash`,void 0),e([A()],W.prototype,`teams`,void 0),e([A()],W.prototype,`agents`,void 0),e([A()],W.prototype,`isFormOpen`,void 0),e([A()],W.prototype,`formMode`,void 0),e([A()],W.prototype,`teamId`,void 0),e([A()],W.prototype,`teamName`,void 0),e([A()],W.prototype,`leaderAgentId`,void 0),e([A()],W.prototype,`memberAgentIds`,void 0),W=e([k(`teams-manager`)],W);var G=class extends O{constructor(...e){super(...e),this.config=null,this.agents=[],this.selectedAgentId=``,this.files=[],this.selectedFilename=``,this.fileContent=``,this.isSaving=!1,this.isModified=!1,this.activeTab=`split`,this.wsClient=j.getInstance()}static{this.styles=s`
    :host {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 120px);
      gap: 1rem;
    }

    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 0.75rem 1.25rem;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }

    .selector-group {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-secondary);
    }

    select {
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      padding: 0.45rem 0.75rem;
      outline: none;
      font-size: 0.9rem;
      font-family: var(--font-sans);
    }

    .btn {
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 0.45rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.85rem;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .btn:hover {
      background-color: var(--border-color);
    }

    .btn-primary {
      background-color: var(--accent-primary);
      border-color: var(--accent-primary);
    }

    .btn-primary:hover {
      opacity: 0.9;
    }

    .status-badge {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      background-color: rgba(255, 255, 255, 0.05);
      color: var(--text-muted);
    }

    .status-badge.modified {
      background-color: var(--status-yellow-glow);
      color: var(--status-yellow);
    }

    .status-badge.saving {
      background-color: var(--accent-glow);
      color: var(--accent-secondary);
    }

    /* Workspace layout */
    .workspace {
      display: grid;
      grid-template-columns: 240px 1fr;
      gap: 1rem;
      flex: 1;
      min-height: 0;
    }

    .sidebar {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      overflow-y: auto;
    }

    .sidebar-title {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--accent-secondary);
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.25rem;
    }

    .file-list {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .file-item {
      padding: 0.5rem 0.75rem;
      font-size: 0.85rem;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      color: var(--text-secondary);
      font-family: var(--font-mono);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .file-item:hover {
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
    }

    .file-item.active {
      background-color: var(--accent-glow);
      color: var(--accent-secondary);
      border-left: 3px solid var(--accent-secondary);
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
    }

    .editor-container {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-height: 0;
    }

    .tab-bar {
      display: flex;
      background-color: var(--bg-tertiary);
      border-bottom: 1px solid var(--border-color);
      padding: 0.25rem 0.5rem 0 0.5rem;
      gap: 0.25rem;
    }

    .tab-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      padding: 0.45rem 1rem;
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      border-top-left-radius: 6px;
      border-top-right-radius: 6px;
      transition: all 0.2s;
    }

    .tab-btn:hover {
      color: var(--text-primary);
      background-color: rgba(255,255,255,0.02);
    }

    .tab-btn.active {
      color: var(--accent-secondary);
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-bottom-color: var(--bg-secondary);
      font-weight: 600;
    }

    .editor-workspace {
      flex: 1;
      display: grid;
      min-height: 0;
    }

    .editor-workspace.split {
      grid-template-columns: 1fr 1fr;
    }

    .editor-pane {
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--border-color);
      height: 100%;
      min-height: 0;
    }

    textarea {
      flex: 1;
      background-color: var(--bg-primary);
      border: none;
      color: var(--text-primary);
      padding: 1rem;
      font-family: var(--font-mono);
      font-size: 0.9rem;
      line-height: 1.5;
      resize: none;
      outline: none;
      height: 100%;
      overflow-y: auto;
    }

    .preview-pane {
      background-color: var(--bg-secondary);
      padding: 1.5rem;
      overflow-y: auto;
      height: 100%;
      color: var(--text-primary);
      line-height: 1.6;
      font-family: var(--font-sans);
    }

    /* Markdown Rendering Styling */
    .preview-pane h1 {
      font-size: 1.75rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.3rem;
      margin-top: 0;
      margin-bottom: 1rem;
    }
    
    .preview-pane h2 {
      font-size: 1.35rem;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      padding-bottom: 0.25rem;
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
    }

    .preview-pane h3 {
      font-size: 1.1rem;
      margin-top: 1.25rem;
      margin-bottom: 0.5rem;
    }

    .preview-pane p {
      margin-bottom: 1rem;
    }

    .preview-pane code {
      font-family: var(--font-mono);
      background-color: var(--bg-primary);
      padding: 0.15rem 0.35rem;
      border-radius: 4px;
      font-size: 0.85rem;
      color: var(--accent-secondary);
    }

    .preview-pane pre {
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      padding: 1rem;
      border-radius: 6px;
      overflow-x: auto;
      margin-bottom: 1rem;
    }

    .preview-pane pre code {
      background: none;
      padding: 0;
      color: var(--text-primary);
    }

    .preview-pane ul, .preview-pane ol {
      margin-bottom: 1rem;
      padding-left: 1.5rem;
    }

    .preview-pane blockquote {
      border-left: 4px solid var(--accent-primary);
      background-color: rgba(0, 240, 255, 0.03);
      padding: 0.5rem 1rem;
      margin: 0 0 1rem 0;
      border-radius: 0 4px 4px 0;
    }

    .preview-pane blockquote.alert-note {
      border-left-color: var(--accent-secondary);
      background-color: rgba(123, 97, 255, 0.04);
    }

    .preview-pane blockquote.alert-warning {
      border-left-color: var(--status-yellow);
      background-color: rgba(255, 170, 0, 0.04);
    }

    .preview-pane blockquote.alert-danger {
      border-left-color: var(--status-red);
      background-color: rgba(255, 51, 102, 0.04);
    }
  `}connectedCallback(){super.connectedCallback(),this.loadConfig()}async loadConfig(){try{let e=await this.wsClient.send(`getSystemConfig`);this.config=e.config,this.agents=this.config.agents||[],this.agents.length>0&&!this.selectedAgentId&&(this.selectedAgentId=this.agents[0].id,this.loadFilesList())}catch(e){console.error(`[AgentFiles] Failed to load configuration:`,e)}}async loadFilesList(){if(this.selectedAgentId)try{let e=await this.wsClient.send(`listAgentFiles`,{agentId:this.selectedAgentId});if(this.files=e.files||[],this.files.length>0){let e=this.files.find(e=>e.toUpperCase().includes(`SOUL`))||this.files[0];this.loadFile(e)}else this.selectedFilename=``,this.fileContent=``,this.isModified=!1}catch(e){console.error(`[AgentFiles] Failed to load files list:`,e),this.files=[],this.selectedFilename=``,this.fileContent=``,this.isModified=!1}}async loadFile(e){if(!(!this.selectedAgentId||!e)&&!(this.isModified&&!confirm(`You have unsaved changes. Discard them?`)))try{let t=await this.wsClient.send(`readAgentFile`,{agentId:this.selectedAgentId,filename:e});this.selectedFilename=e,this.fileContent=t.content,this.isModified=!1}catch(e){console.error(`[AgentFiles] Failed to load file content:`,e)}}handleEditorInput(e){this.fileContent=e.target.value,this.isModified=!0}async saveFile(){if(!(!this.selectedAgentId||!this.selectedFilename)){this.isSaving=!0;try{await this.wsClient.send(`writeAgentFile`,{agentId:this.selectedAgentId,filename:this.selectedFilename,content:this.fileContent}),this.isModified=!1,alert(`File ${this.selectedFilename} saved successfully!`),await this.loadFilesList()}catch(e){alert(`Save failed: ${e.message}`)}finally{this.isSaving=!1}}}createNewFile(){let e=window.prompt(`Enter new file path (e.g. soul.md or proactivity/memory.md):`);if(!e)return;let t=e.trim().replace(/\\/g,`/`);if(t.endsWith(`.md`)||(t+=`.md`),this.files.includes(t)){alert(`File already exists in workspace.`);return}this.selectedFilename=t,this.fileContent=`# ${t.split(`/`).pop()?.replace(`.md`,``)}\n\n`,this.isModified=!0,this.activeTab=`edit`}handleAgentChange(e){if(this.isModified&&!confirm(`You have unsaved changes. Discard them?`)){e.target.value=this.selectedAgentId;return}this.selectedAgentId=e.target.value,this.loadFilesList()}parseMarkdown(e){if(!e)return``;let t=e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`);return t=t.replace(/```([\s\S]*?)```/gm,(e,t)=>`<pre><code>${t.trim()}</code></pre>`),t=t.replace(/`([^`]+)`/g,`<code>$1</code>`),t=t.replace(/^### (.*$)/gim,`<h3>$1</h3>`),t=t.replace(/^## (.*$)/gim,`<h2>$1</h2>`),t=t.replace(/^# (.*$)/gim,`<h1>$1</h1>`),t=t.replace(/^&gt;\s*\[!NOTE\]\s*([\s\S]*?)(?=\n\n|\n^[^&gt;]|$)/gim,(e,t)=>`<blockquote class="alert-note"><strong>NOTE:</strong><br>${t.replace(/^&gt;\s?/gm,``).trim()}</blockquote>`),t=t.replace(/^&gt;\s*\[!IMPORTANT\]\s*([\s\S]*?)(?=\n\n|\n^[^&gt;]|$)/gim,(e,t)=>`<blockquote class="alert-note"><strong>IMPORTANT:</strong><br>${t.replace(/^&gt;\s?/gm,``).trim()}</blockquote>`),t=t.replace(/^&gt;\s*\[!WARNING\]\s*([\s\S]*?)(?=\n\n|\n^[^&gt;]|$)/gim,(e,t)=>`<blockquote class="alert-warning"><strong>WARNING:</strong><br>${t.replace(/^&gt;\s?/gm,``).trim()}</blockquote>`),t=t.replace(/^&gt;\s*\[!CAUTION\]\s*([\s\S]*?)(?=\n\n|\n^[^&gt;]|$)/gim,(e,t)=>`<blockquote class="alert-danger"><strong>CAUTION:</strong><br>${t.replace(/^&gt;\s?/gm,``).trim()}</blockquote>`),t=t.replace(/^&gt;\s*(.*$)/gim,`<blockquote>$1</blockquote>`),t=t.replace(/\*\*([^*]+)\*\*/g,`<strong>$1</strong>`),t=t.replace(/\*([^*]+)\*/g,`<em>$1</em>`),t=t.replace(/^\s*-\s+(.*$)/gim,`<li>$1</li>`),t=t.replace(/<li>(.*)<\/li>/g,e=>`<ul>${e}</ul>`),t=t.replace(/<\/ul>\s*<ul>/g,``),t=t.replace(/\n\s*\n/g,`</p><p>`),t=`<p>${t}</p>`,t=t.replace(/<p>\s*<\/p>/g,``),t}render(){let e=this.parseMarkdown(this.fileContent);return S`
      <div class="header-bar">
        <div class="selector-group">
          <label for="agentSelect">Agent Workspace</label>
          <select id="agentSelect" .value=${this.selectedAgentId} @change=${this.handleAgentChange}>
            ${this.agents.map(e=>S`
              <option value=${e.id}>${e.name||e.id}</option>
            `)}
          </select>

          ${this.selectedFilename?S`
            <span style="color: var(--text-muted)">/</span>
            <code style="font-size: 0.95rem; font-weight: bold; color: var(--accent-secondary)">${this.selectedFilename}</code>
          `:``}
        </div>

        <div style="display: flex; gap: 0.75rem; align-items: center">
          ${this.isSaving?S`
            <span class="status-badge saving">💾 Saving...</span>
          `:this.isModified?S`
            <span class="status-badge modified">● Unsaved changes</span>
          `:S`
            <span class="status-badge">✓ Saved</span>
          `}

          <button 
            class="btn btn-primary" 
            @click=${this.saveFile}
            ?disabled=${!this.selectedFilename||this.isSaving||!this.isModified}
          >
            💾 Save File
          </button>
        </div>
      </div>

      <div class="workspace">
        <!-- Files Sidebar -->
        <div class="sidebar">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 0.25rem; margin-bottom: 0.5rem">
            <div class="sidebar-title" style="border: none; padding: 0; margin: 0">Workspace Markdown</div>
            <button class="btn" style="padding: 0.15rem 0.4rem; font-size: 0.75rem" @click=${this.createNewFile}>➕ New</button>
          </div>
          <div class="file-list">
            ${this.files.length===0?S`
              <div style="font-size: 0.8rem; color: var(--text-muted); font-style: italic; padding: 1rem 0">
                No markdown files found
              </div>
            `:this.files.map(e=>S`
              <div 
                class="file-item ${this.selectedFilename===e?`active`:``}" 
                @click=${()=>this.loadFile(e)}
              >
                📄 ${e}
              </div>
            `)}
          </div>
        </div>

        <!-- Editor Work Area -->
        <div class="editor-container">
          <div class="tab-bar">
            <button class="tab-btn ${this.activeTab===`edit`?`active`:``}" @click=${()=>this.activeTab=`edit`}>
              📝 Edit Source
            </button>
            <button class="tab-btn ${this.activeTab===`preview`?`active`:``}" @click=${()=>this.activeTab=`preview`}>
              👁️ HTML Preview
            </button>
            <button class="tab-btn ${this.activeTab===`split`?`active`:``}" @click=${()=>this.activeTab=`split`}>
              🌓 Side Split View
            </button>
          </div>

          <div class="editor-workspace ${this.activeTab===`split`?`split`:``}">
            ${this.activeTab===`edit`||this.activeTab===`split`?S`
              <div class="editor-pane">
                <textarea 
                  .value=${this.fileContent}
                  @input=${this.handleEditorInput}
                  placeholder="Select a file from the sidebar to view and edit..."
                  ?disabled=${!this.selectedFilename}
                ></textarea>
              </div>
            `:``}

            ${this.activeTab===`preview`||this.activeTab===`split`?S`
              <div class="preview-pane">
                ${this.selectedFilename?S`
                  <div .innerHTML=${e}></div>
                `:S`
                  <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); font-style: italic">
                    Select a markdown file to display render preview
                  </div>
                `}
              </div>
            `:``}
          </div>
        </div>
      </div>
    `}};e([A()],G.prototype,`config`,void 0),e([A()],G.prototype,`agents`,void 0),e([A()],G.prototype,`selectedAgentId`,void 0),e([A()],G.prototype,`files`,void 0),e([A()],G.prototype,`selectedFilename`,void 0),e([A()],G.prototype,`fileContent`,void 0),e([A()],G.prototype,`isSaving`,void 0),e([A()],G.prototype,`isModified`,void 0),e([A()],G.prototype,`activeTab`,void 0),G=e([k(`agent-files`)],G);var K=class extends O{constructor(...e){super(...e),this.config=null,this.baseHash=``,this.activeTab=`providers`,this.providers=[],this.models=[],this.isFormOpen=!1,this.formMode=`add`,this.provId=``,this.provName=``,this.provBaseUrl=``,this.provApiKeyEnv=``,this.modelId=``,this.modelName=``,this.modelProv=``,this.modelCtx=128e3,this.wsClient=j.getInstance()}static{this.styles=s`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .title {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .tabs {
      display: flex;
      gap: 0.5rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.25rem;
    }

    .tab {
      background: none;
      border: none;
      color: var(--text-secondary);
      padding: 0.5rem 1rem;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.95rem;
      position: relative;
    }

    .tab.active {
      color: var(--accent-secondary);
    }

    .tab.active::after {
      content: "";
      position: absolute;
      bottom: -4px;
      left: 0;
      right: 0;
      height: 3px;
      background-color: var(--accent-secondary);
      border-radius: 2px;
    }

    .panel {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .list-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }

    .card {
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      position: relative;
    }

    .card-title {
      font-family: var(--font-display);
      font-weight: 600;
      font-size: 1.05rem;
      color: var(--text-primary);
    }

    .card-sub {
      font-size: 0.8rem;
      color: var(--text-secondary);
      font-family: var(--font-mono);
    }

    .card-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: auto;
    }

    /* Form Overlay */
    .overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      z-index: 100;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .modal-box {
      width: 450px;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-secondary);
    }

    input, select {
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      padding: 0.5rem 0.6rem;
      outline: none;
      font-size: 0.9rem;
    }

    .btn {
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      font-size: 0.85rem;
      transition: all 0.2s;
    }

    .btn:hover {
      background-color: var(--border-color);
    }

    .btn-primary {
      background-color: var(--accent-primary);
      border-color: var(--accent-primary);
    }

    .btn-danger {
      color: var(--status-red);
      border-color: rgba(255, 51, 102, 0.3);
    }

    .btn-danger:hover {
      background-color: var(--status-red-glow);
    }
  `}connectedCallback(){super.connectedCallback(),this.loadConfig()}async loadConfig(){try{let e=await this.wsClient.send(`getSystemConfig`);if(this.config=e.config,this.baseHash=e.hash,this.providers=[],this.models=[],this.config.models&&this.config.models.providers){let e=this.config.models.providers;for(let[t,n]of Object.entries(e)){let e=n;this.providers.push({id:t,name:e.name||t,baseUrl:e.baseUrl||``,apiKeyEnv:e.apiKey||``});let r=e.models||[];for(let e of r)this.models.push({id:e.id,name:e.name||e.id,provider:t,contextLength:e.contextWindow||128e3})}}else this.config.models={mode:`merge`,providers:{}}}catch(e){console.error(`[ModelsManager] Failed to load config:`,e)}}async saveToConfig(){try{let e=await this.wsClient.send(`saveSystemConfig`,{config:this.config,baseHash:this.baseHash});e.success?(this.baseHash=e.hash,alert(`Models config successfully updated.`),this.loadConfig()):alert(`Failed to save changes.`)}catch(e){console.error(`[ModelsManager] Failed to save:`,e)}}openAddProvider(){this.formMode=`add`,this.provId=``,this.provName=``,this.provBaseUrl=``,this.provApiKeyEnv=``,this.isFormOpen=!0}openEditProvider(e){this.formMode=`edit`,this.provId=e.id,this.provName=e.name,this.provBaseUrl=e.baseUrl||``,this.provApiKeyEnv=e.apiKeyEnv||``,this.isFormOpen=!0}deleteProvider(e){confirm(`Are you sure you want to delete provider ${e}?`)&&this.config.models?.providers&&(delete this.config.models.providers[e],this.saveToConfig())}saveProviderForm(){if(!this.provId||!this.provName){alert(`ID and Name are required.`);return}this.config.models||(this.config.models={mode:`merge`,providers:{}}),this.config.models.providers||(this.config.models.providers={});let e=this.config.models.providers[this.provId]||{};this.config.models.providers[this.provId]={...e,name:this.provName,baseUrl:this.provBaseUrl||void 0,apiKey:this.provApiKeyEnv||void 0,api:e.api||`openai-responses`,models:e.models||[]},this.isFormOpen=!1,this.saveToConfig()}openAddModel(){this.formMode=`add`,this.modelId=``,this.modelName=``,this.modelProv=this.providers[0]?.id||`gemini`,this.modelCtx=128e3,this.isFormOpen=!0}openEditModel(e){this.formMode=`edit`,this.modelId=e.id,this.modelName=e.name,this.modelProv=e.provider,this.modelCtx=e.contextLength||128e3,this.isFormOpen=!0}deleteModel(e,t){if(!confirm(`Are you sure you want to delete model ${t}?`))return;let n=this.config.models?.providers?.[e];n&&n.models&&(n.models=n.models.filter(e=>e.id!==t),this.saveToConfig())}saveModelForm(){if(!this.modelId||!this.modelName){alert(`ID and Name are required.`);return}let e=this.config.models?.providers?.[this.modelProv];if(!e){alert(`Selected provider does not exist.`);return}e.models||=[];let t={id:this.modelId,name:this.modelName,contextWindow:this.modelCtx,maxTokens:4096},n=e.models.findIndex(e=>e.id===this.modelId);n>-1?e.models[n]=t:e.models.push(t),this.isFormOpen=!1,this.saveToConfig()}render(){return S`
      <div class="title-row">
        <div class="title">LLM Providers & Models Manager</div>
        <button class="btn btn-primary" @click=${this.activeTab===`providers`?this.openAddProvider:this.openAddModel}>
          ➕ Add ${this.activeTab===`providers`?`Provider`:`Model`}
        </button>
      </div>

      <div class="tabs">
        <button class="tab ${this.activeTab===`providers`?`active`:``}" @click=${()=>this.activeTab=`providers`}>
          🔌 API Providers
        </button>
        <button class="tab ${this.activeTab===`models`?`active`:``}" @click=${()=>this.activeTab=`models`}>
          🧠 Models Catalog
        </button>
      </div>

      <div class="panel">
        ${this.activeTab===`providers`?this.renderProviders():this.renderModels()}
      </div>

      <!-- Add/Edit Overlay Modals -->
      ${this.isFormOpen?S`
        <div class="overlay" @click=${()=>this.isFormOpen=!1}>
          <div class="modal-box" @click=${e=>e.stopPropagation()}>
            <h3 style="font-family: var(--font-display)">
              ${this.formMode===`add`?`Register New`:`Modify`} ${this.activeTab===`providers`?`Provider`:`Model`}
            </h3>
            
            ${this.activeTab===`providers`?this.renderProviderFormFields():this.renderModelFormFields()}

            <div style="display: flex; gap: 0.5rem; margin-top: 1rem">
              <button class="btn btn-primary" style="flex: 1" @click=${this.activeTab===`providers`?this.saveProviderForm:this.saveModelForm}>
                💾 Save
              </button>
              <button class="btn" @click=${()=>this.isFormOpen=!1}>Cancel</button>
            </div>
          </div>
        </div>
      `:``}
    `}renderProviders(){return S`
      <div class="list-grid">
        ${this.providers.map(e=>S`
          <div class="card">
            <div class="card-title">${e.name}</div>
            <div class="card-sub">ID: ${e.id}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary)">
              <div>Base URL: <code>${e.baseUrl||`Default SDK`}</code></div>
              <div>Key/Token: <code>${e.apiKeyEnv?`••••••••`:`None`}</code></div>
            </div>
            <div class="card-actions">
              <button class="btn" @click=${()=>this.openEditProvider(e)}>⚙️ Edit</button>
              <button class="btn btn-danger" @click=${()=>this.deleteProvider(e.id)}>✕ Delete</button>
            </div>
          </div>
        `)}
      </div>
    `}renderModels(){return S`
      <div class="list-grid">
        ${this.models.map(e=>S`
          <div class="card">
            <div class="card-title">${e.name}</div>
            <div class="card-sub">ID: ${e.id}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary)">
              <div>Provider: <span style="text-transform: uppercase; font-weight: bold; color: var(--accent-secondary)">${e.provider}</span></div>
              <div>Context: <code>${e.contextLength?e.contextLength.toLocaleString():`Unknown`} tokens</code></div>
            </div>
            <div class="card-actions">
              <button class="btn" @click=${()=>this.openEditModel(e)}>⚙️ Edit</button>
              <button class="btn btn-danger" @click=${()=>this.deleteModel(e.provider,e.id)}>✕ Delete</button>
            </div>
          </div>
        `)}
      </div>
    `}renderProviderFormFields(){return S`
      <div class="form-group">
        <label for="provId">Provider Identifier ID</label>
        <input 
          type="text" 
          id="provId" 
          placeholder="e.g. ollama or openai-compatible" 
          .value=${this.provId}
          @input=${e=>this.provId=e.target.value}
          ?disabled=${this.formMode===`edit`}
        />
      </div>

      <div class="form-group">
        <label for="provName">Provider Name</label>
        <input 
          type="text" 
          id="provName" 
          placeholder="e.g. Ollama Localhost" 
          .value=${this.provName}
          @input=${e=>this.provName=e.target.value}
        />
      </div>

      <div class="form-group">
        <label for="provBaseUrl">Base API Endpoint URL (Optional)</label>
        <input 
          type="text" 
          id="provBaseUrl" 
          placeholder="e.g. http://localhost:11434/v1" 
          .value=${this.provBaseUrl}
          @input=${e=>this.provBaseUrl=e.target.value}
        />
      </div>

      <div class="form-group">
        <label for="provApiKeyEnv">API Key Token (Optional)</label>
        <input 
          type="password" 
          id="provApiKeyEnv" 
          placeholder="e.g. sk-..." 
          .value=${this.provApiKeyEnv}
          @input=${e=>this.provApiKeyEnv=e.target.value}
        />
      </div>
    `}renderModelFormFields(){return S`
      <div class="form-group">
        <label for="modelId">Model ID / Name Identifier</label>
        <input 
          type="text" 
          id="modelId" 
          placeholder="e.g. gpt-4o or llama3" 
          .value=${this.modelId}
          @input=${e=>this.modelId=e.target.value}
          ?disabled=${this.formMode===`edit`}
        />
      </div>

      <div class="form-group">
        <label for="modelName">Model Readable Name</label>
        <input 
          type="text" 
          id="modelName" 
          placeholder="e.g. GPT-4o Enterprise" 
          .value=${this.modelName}
          @input=${e=>this.modelName=e.target.value}
        />
      </div>

      <div class="form-group">
        <label for="modelProv">Provider</label>
        <select id="modelProv" .value=${this.modelProv} @change=${e=>this.modelProv=e.target.value}>
          ${this.providers.map(e=>S`
            <option value=${e.id}>${e.name}</option>
          `)}
        </select>
      </div>

      <div class="form-group">
        <label for="modelCtx">Context Window Length (tokens)</label>
        <input 
          type="number" 
          id="modelCtx" 
          .value=${this.modelCtx}
          @input=${e=>this.modelCtx=parseInt(e.target.value,10)}
        />
      </div>
    `}};e([A()],K.prototype,`config`,void 0),e([A()],K.prototype,`baseHash`,void 0),e([A()],K.prototype,`activeTab`,void 0),e([A()],K.prototype,`providers`,void 0),e([A()],K.prototype,`models`,void 0),e([A()],K.prototype,`isFormOpen`,void 0),e([A()],K.prototype,`formMode`,void 0),e([A()],K.prototype,`provId`,void 0),e([A()],K.prototype,`provName`,void 0),e([A()],K.prototype,`provBaseUrl`,void 0),e([A()],K.prototype,`provApiKeyEnv`,void 0),e([A()],K.prototype,`modelId`,void 0),e([A()],K.prototype,`modelName`,void 0),e([A()],K.prototype,`modelProv`,void 0),e([A()],K.prototype,`modelCtx`,void 0),K=e([k(`models-manager`)],K);var q=class extends O{constructor(...e){super(...e),this.activeAgent=``,this.config=null,this.baseHash=``,this.agents=[],this.promptDrift=[],this.learningLog=[],this.histogram={},this.isStatsLoading=!1,this.wsClient=j.getInstance()}static{this.styles=s`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .title {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .agent-select {
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      padding: 0.4rem 0.6rem;
      outline: none;
      font-size: 0.85rem;
    }

    /* Glassmorphism Panel styles */
    .glass-card {
      background: rgba(30, 41, 59, 0.45);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: var(--border-radius);
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
    }

    .section-title {
      font-family: var(--font-display);
      font-size: 1.15rem;
      font-weight: 600;
      color: var(--accent-secondary);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      padding-bottom: 0.5rem;
    }

    /* Toggle Switch Styles */
    .toggle-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(255, 255, 255, 0.02);
      padding: 1rem;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.04);
    }

    .toggle-desc {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .toggle-label {
      font-weight: 600;
      font-size: 0.95rem;
      color: var(--text-primary);
    }

    .toggle-sub {
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .switch {
      position: relative;
      display: inline-block;
      width: 48px;
      height: 24px;
    }

    .switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(255, 255, 255, 0.15);
      transition: .3s;
      border-radius: 24px;
    }

    .slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: .3s;
      border-radius: 50%;
    }

    input:checked + .slider {
      background-color: var(--accent-primary);
      box-shadow: 0 0 8px var(--accent-primary);
    }

    input:checked + .slider:before {
      transform: translateX(24px);
    }

    /* Timeline styles */
    .timeline {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      position: relative;
      padding-left: 1.5rem;
      margin-top: 0.5rem;
    }

    .timeline-line {
      position: absolute;
      left: 5px;
      top: 5px;
      bottom: 5px;
      width: 2px;
      background: rgba(255, 255, 255, 0.1);
    }

    .timeline-item {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .timeline-dot {
      position: absolute;
      left: -23px;
      top: 4px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent-secondary);
      box-shadow: 0 0 8px var(--accent-secondary);
    }

    .timeline-time {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-family: var(--font-mono);
    }

    .timeline-content {
      font-size: 0.88rem;
      color: var(--text-secondary);
      background: rgba(0, 0, 0, 0.15);
      padding: 0.6rem 0.8rem;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.03);
      font-family: var(--font-mono);
    }

    /* Table styles */
    .hist-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 0.5rem;
    }

    .hist-table th, .hist-table td {
      text-align: left;
      padding: 0.6rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 0.85rem;
    }

    .hist-table th {
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.5px;
    }

    .hist-table td {
      color: var(--text-secondary);
    }

    .progress-bar-container {
      width: 100px;
      height: 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      overflow: hidden;
      display: inline-block;
      vertical-align: middle;
      margin-right: 0.5rem;
    }

    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
    }

    /* Sparkline grid */
    .sparkline-row {
      display: flex;
      align-items: flex-end;
      gap: 3px;
      height: 32px;
      background: rgba(0, 0, 0, 0.15);
      padding: 6px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.03);
    }

    .sparkline-bar {
      flex: 1;
      background-color: var(--accent-primary);
      min-width: 4px;
      border-radius: 1px;
    }

    .empty-state {
      font-style: italic;
      color: var(--text-muted);
      font-size: 0.85rem;
      padding: 0.5rem 0;
    }
  `}connectedCallback(){super.connectedCallback(),this.loadConfig()}async loadConfig(){try{let e=await this.wsClient.send(`getSystemConfig`);this.config=e.config,this.baseHash=e.hash,this.agents=this.config.agents||[],this.agents.length>0&&!this.activeAgent&&(this.activeAgent=this.agents[0].id),await this.loadAdvancedStats()}catch(e){console.error(`[AdvancedPanel] Failed to load config:`,e)}}async loadAdvancedStats(){if(this.activeAgent){this.isStatsLoading=!0;try{let e=await this.wsClient.send(`getAgentAdvancedStats`,{agentId:this.activeAgent});this.promptDrift=e.promptDrift||[],this.learningLog=e.learningLog||[],this.histogram=e.histogram||{}}catch(e){console.error(`[AdvancedPanel] Failed to load advanced stats:`,e)}finally{this.isStatsLoading=!1}}}async handleAgentChange(e){this.activeAgent=e.target.value,await this.loadAdvancedStats()}async saveConfigUpdate(e){this.config.agents=e;try{let e=await this.wsClient.send(`saveSystemConfig`,{config:this.config,baseHash:this.baseHash});e.success?(this.baseHash=e.hash,console.log(`[AdvancedPanel] Agent config updated successfully.`)):alert(`Failed to save configuration update.`)}catch(e){alert(`Save error: ${e.message}`)}}async handleUnrestrictedToggle(e){if(!this.config||!this.activeAgent)return;let t=e.target.checked,n=this.config.agents.map(e=>e.id===this.activeAgent?{...e,toolPolicy:{...e.toolPolicy,allowUnrestrictedCommands:t}}:e);await this.saveConfigUpdate(n)}async handleSelfImprovementToggle(e){if(!this.config||!this.activeAgent)return;let t=e.target.checked,n=this.config.agents.map(e=>e.id===this.activeAgent?{...e,toolPolicy:{...e.toolPolicy,allowSelfImprovement:t}}:e);await this.saveConfigUpdate(n)}async handleContextLimitChange(e){if(!this.config||!this.activeAgent)return;let t=parseInt(e.target.value,10),n=this.config.agents.map(e=>e.id===this.activeAgent?{...e,contextLimit:t,toolPolicy:{...e.toolPolicy,contextLimit:t}}:e);await this.saveConfigUpdate(n)}render(){if(this.isStatsLoading)return S`<div style="padding: 2rem; text-align: center; color: var(--text-muted);">Loading advanced agent metrics...</div>`;let e=this.agents.find(e=>e.id===this.activeAgent),t=e?.toolPolicy?.allowUnrestrictedCommands??!1,n=e?.toolPolicy?.allowSelfImprovement??!1,r=e?.contextLimit??e?.toolPolicy?.contextLimit??15e3,i=this.learningLog.length>0?(this.learningLog.reduce((e,t)=>e+t.confidence,0)/this.learningLog.length*100).toFixed(0):`N/A`,a=this.learningLog.length>0?(this.learningLog.filter(e=>e.success).length/this.learningLog.length*100).toFixed(0):`N/A`;return S`
      <div class="title-row">
        <div class="title">Advanced AI Settings & Compaction</div>
        <select class="agent-select" .value=${this.activeAgent} @change=${this.handleAgentChange}>
          ${this.agents.map(e=>S`
            <option value=${e.id}>${e.name||e.id}</option>
          `)}
        </select>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem">
        <div class="glass-card">
          <div class="section-title">🛡️ Unrestricted Command Gating</div>
          <div class="toggle-row" style="margin-top: 0.5rem">
            <div class="toggle-desc">
              <span class="toggle-label">Bypass Command Approval Gating</span>
              <span class="toggle-sub">
                Allows the agent to execute shell commands (exec) directly without requesting admin Telegram card confirmation.
              </span>
            </div>
            <label class="switch">
              <input type="checkbox" .checked=${t} @change=${this.handleUnrestrictedToggle} />
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <div class="glass-card">
          <div class="section-title">🧠 Cognitive Architecture Settings</div>
          <div class="toggle-row" style="margin-top: 0.5rem">
            <div class="toggle-desc">
              <span class="toggle-label">Self-Refinement & Learning Mode</span>
              <span class="toggle-sub">
                Enables the agent to dynamically refine its playbooks, persist daily learnings, and auto-correct strategy on failures.
              </span>
            </div>
            <label class="switch">
              <input type="checkbox" .checked=${n} @change=${this.handleSelfImprovementToggle} />
              <span class="slider"></span>
            </label>
          </div>
        </div>
      </div>

      <div class="glass-card">
        <div class="section-title">⚡ Context Compaction Threshold</div>
        <div style="background: rgba(255, 255, 255, 0.02); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.04); display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.5rem">
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span class="toggle-label" style="font-size: 0.95rem">Compaction Threshold Limit</span>
            <span style="font-family: var(--font-mono); font-size: 0.95rem; font-weight: bold; color: var(--accent-secondary)">${r.toLocaleString()} tokens</span>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-muted)">
            Controls the token limit at which the agent automatically compacts its history to optimize API costs and latency.
          </div>
          <input 
            type="range" 
            min="5000" 
            max="25000" 
            step="1000" 
            .value=${r} 
            @input=${this.handleContextLimitChange} 
            style="width: 100%; accent-color: var(--accent-primary); cursor: pointer;"
          />
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem">
        <div class="glass-card">
          <div class="section-title">🧠 Meta-Cognitive Prompt Drift</div>
          ${this.promptDrift.length===0?S`
            <div class="empty-state">No dynamic prompt adjustments recorded yet. The agent is running on its baseline instruction set.</div>
          `:S`
            <div class="timeline">
              <div class="timeline-line"></div>
              ${this.promptDrift.map(e=>S`
                <div class="timeline-item">
                  <div class="timeline-dot"></div>
                  <div class="timeline-time">${new Date(e.timestamp).toLocaleString()}</div>
                  <div class="timeline-content">${e.delta}</div>
                </div>
              `)}
            </div>
          `}
        </div>

        <div class="glass-card">
          <div class="section-title">📊 Closed Learning Logs & Confidence</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem">
            <div style="background: rgba(0, 0, 0, 0.15); padding: 0.75rem; border-radius: 8px; text-align: center">
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--accent-primary)">${i}%</div>
              <div style="font-size: 0.75rem; color: var(--text-muted)">Avg Confidence Score</div>
            </div>
            <div style="background: rgba(0, 0, 0, 0.15); padding: 0.75rem; border-radius: 8px; text-align: center">
              <div style="font-size: 1.5rem; font-weight: 700; color: var(--status-green)">${a}%</div>
              <div style="font-size: 0.75rem; color: var(--text-muted)">Tool Success Rate</div>
            </div>
          </div>

          <div style="margin-top: 0.5rem">
            <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted); margin-bottom: 0.5rem">Recent Confidence Log</div>
            ${this.learningLog.length===0?S`
              <div class="empty-state">No logs recorded yet.</div>
            `:S`
              <div class="sparkline-row">
                ${this.learningLog.slice(-20).map(e=>S`
                  <div 
                    class="sparkline-bar" 
                    style="height: ${e.confidence*100}%; background-color: ${e.success?`var(--accent-primary)`:`var(--status-red)`}"
                    title="Session: ${e.sessionId} | Confidence: ${e.confidence.toFixed(2)}"
                  ></div>
                `)}
              </div>
            `}
          </div>
        </div>
      </div>

      <div class="glass-card">
        <div class="section-title">🧰 Skill Performance Histogram</div>
        ${Object.keys(this.histogram).length===0?S`
          <div class="empty-state">No capability runs recorded in the performance registry.</div>
        `:S`
          <table class="hist-table">
            <thead>
              <tr>
                <th>Skill Name / Tool</th>
                <th>Runs</th>
                <th>Success Rate</th>
                <th>Avg Confidence</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(this.histogram).map(([e,t])=>{let n=t.runs>0?t.successes/t.runs*100:0;return S`
                  <tr>
                    <td><code>${e}</code></td>
                    <td>${t.runs}</td>
                    <td>
                      <div class="progress-bar-container">
                        <div class="progress-bar-fill" style="width: ${n}%"></div>
                      </div>
                      <span>${n.toFixed(0)}%</span>
                    </td>
                    <td>${(t.avgConfidence*100).toFixed(0)}%</td>
                  </tr>
                `})}
            </tbody>
          </table>
        `}
      </div>
    `}};e([A()],q.prototype,`activeAgent`,void 0),e([A()],q.prototype,`config`,void 0),e([A()],q.prototype,`baseHash`,void 0),e([A()],q.prototype,`agents`,void 0),e([A()],q.prototype,`promptDrift`,void 0),e([A()],q.prototype,`learningLog`,void 0),e([A()],q.prototype,`histogram`,void 0),e([A()],q.prototype,`isStatsLoading`,void 0),q=e([k(`advanced-panel`)],q);var J=class extends O{constructor(...e){super(...e),this.activeAgent=``,this.config=null,this.agents=[],this.wsClient=j.getInstance(),this.quieter=!1,this.rules=[],this.logEntries=[],this.resolvedContextMode=`unknown`,this.activeSignals=[]}static{this.styles=s`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .title {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .panel {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .panel-title {
      font-size: 1.15rem;
      font-weight: 600;
      color: var(--text-primary);
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.5rem;
      margin-bottom: 0.5rem;
    }

    select {
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      padding: 0.4rem 0.6rem;
      outline: none;
      font-size: 0.85rem;
      cursor: pointer;
    }

    .control-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      padding: 1rem;
      border-radius: 8px;
    }

    .toggle-container {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 46px;
      height: 24px;
    }

    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: var(--border-color);
      transition: .3s;
      border-radius: 24px;
    }

    .slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: var(--text-primary);
      transition: .3s;
      border-radius: 50%;
    }

    input:checked + .slider {
      background-color: var(--accent-primary);
    }

    input:checked + .slider:before {
      transform: translateX(22px);
    }

    .rule-grid {
      display: grid;
      grid-template-columns: 1fr 2fr 1fr;
      gap: 0.75rem;
      font-size: 0.85rem;
    }

    .rule-header {
      font-weight: 600;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.25rem;
    }

    .rule-row {
      border-bottom: 1px dashed var(--border-color);
      padding: 0.4rem 0;
      color: var(--text-secondary);
    }

    .badge {
      display: inline-block;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: bold;
    }

    .badge-do {
      background: rgba(46, 204, 113, 0.2);
      color: var(--status-green);
    }

    .badge-suggest {
      background: rgba(52, 152, 219, 0.2);
      color: var(--accent-secondary);
    }

    .badge-ask {
      background: rgba(241, 196, 15, 0.2);
      color: #f1c40f;
    }

    .badge-never {
      background: rgba(231, 76, 60, 0.2);
      color: #e74c3c;
    }

    .btn {
      background-color: var(--accent-primary);
      border: none;
      color: white;
      padding: 0.4rem 0.8rem;
      border-radius: 4px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: background 0.3s;
    }

    .btn:hover {
      background-color: var(--accent-secondary);
    }

    .btn-danger {
      background-color: #e74c3c;
    }

    .btn-danger:hover {
      background-color: #c0392b;
    }

    .logs-box {
      max-height: 200px;
      overflow-y: auto;
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      padding: 0.75rem;
      border-radius: 6px;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .log-line {
      color: var(--text-muted);
    }

    .empty-state {
      text-align: center;
      color: var(--text-muted);
      padding: 1.5rem;
      font-style: italic;
    }

    .context-mode {
      font-size: 1.1rem;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .mode-desk { color: var(--status-green); }
    .mode-mobile { color: var(--accent-secondary); }
    .mode-dnd { color: #e74c3c; }
    .mode-unknown { color: var(--text-muted); }
  `}connectedCallback(){super.connectedCallback(),this.loadConfig(),this.wsClient.addEventListener((e,t)=>{e===`busMessage`&&t&&t.topic===`loop_progress`&&this.fetchStatus()})}async loadConfig(){try{let e=await this.wsClient.send(`getSystemConfig`);this.config=e.config,this.agents=this.config.agents||[],this.agents.length>0&&(this.activeAgent=this.agents[0].id,this.fetchStatus())}catch(e){console.error(`[AutonomyPage] Failed to load configuration:`,e)}}async fetchStatus(){if(this.activeAgent)try{let e=await this.wsClient.send(`getAgentProactivityStatus`,{agentId:this.activeAgent});e&&(this.quieter=e.quieter||!1,this.rules=e.rules||[],this.logEntries=e.logEntries||[]),await this.fetchContext()}catch(e){console.error(`[AutonomyPage] Failed to query proactivity status:`,e)}}async fetchContext(){if(this.activeAgent)try{let e=await this.wsClient.send(`getAgentContext`,{agentId:this.activeAgent});this.resolvedContextMode=e.resolvedMode||`unknown`,this.activeSignals=e.activeSignals||[]}catch(e){console.error(`[AutonomyPage] Failed to fetch context:`,e)}}async handleQuieterToggle(){let e=!this.quieter;try{await this.wsClient.send(`toggleQuieterMode`,{agentId:this.activeAgent,value:e}),this.quieter=e}catch(e){console.error(`[AutonomyPage] Failed to toggle quieter mode:`,e)}}async handleReset(){if(confirm(`Are you sure you want to clear all boundary learning rules for this agent?`))try{await this.wsClient.send(`resetAgentBoundaries`,{agentId:this.activeAgent}),this.fetchStatus()}catch(e){console.error(`[AutonomyPage] Reset boundaries request failed:`,e)}}render(){return S`
      <div class="title-row">
        <div class="title">Autonomy & Behavioral Boundaries</div>
        <select .value=${this.activeAgent} @change=${e=>{this.activeAgent=e.target.value,this.fetchStatus()}}>
          ${this.agents.map(e=>S`
            <option value=${e.id}>${e.name||e.id}</option>
          `)}
        </select>
      </div>

      <div class="panel">
        <div class="panel-title">Active Situational Context</div>
        <div style="display: flex; gap: 2rem; align-items: center;">
          <div>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.25rem;">Resolved Mode</div>
            <div class="context-mode mode-${this.resolvedContextMode===`active-desk`?`desk`:this.resolvedContextMode===`mobile-brief`?`mobile`:this.resolvedContextMode===`do-not-disturb`?`dnd`:`unknown`}">
              ${this.resolvedContextMode===`active-desk`?`🟢 Active Desk`:this.resolvedContextMode===`mobile-brief`?`📱 Mobile Brief`:this.resolvedContextMode===`do-not-disturb`?`🔴 Do Not Disturb`:`⚪ Unknown`}
            </div>
          </div>
          <div style="flex: 1;">
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem;">Active Context Signals</div>
            ${this.activeSignals.length===0?S`
              <div style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">No active signals. Mode is resolved from defaults.</div>
            `:S`
              <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                ${this.activeSignals.map(e=>S`
                  <span style="background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px; padding: 0.25rem 0.5rem; font-size: 0.8rem; display: flex; align-items: center; gap: 0.4rem;">
                    <strong>${e.signalType}</strong>: ${e.value}
                    <span style="font-size: 0.7rem; color: var(--text-muted);">(${e.source})</span>
                  </span>
                `)}
              </div>
            `}
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title">Noise Reduction Control</div>
        <div class="control-row">
          <div>
            <div style="font-weight: 600; margin-bottom: 0.25rem;">Quieter Alert Limit (Noise Reduction)</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">Automatically reduces the daily proactive notification cap by 50% when enabled.</div>
          </div>
          <div class="toggle-container">
            <span style="font-size: 0.85rem; color: var(--text-muted);">${this.quieter?`Enabled`:`Disabled`}</span>
            <label class="toggle-switch">
              <input type="checkbox" .checked=${this.quieter} @change=${this.handleQuieterToggle}>
              <span class="slider"></span>
            </label>
          </div>
        </div>
      </div>

      <div class="panel">
        <div style="display: flex; justify-content: space-between; align-items: center;" class="panel-title">
          <span>Learned Domain Boundaries</span>
          <button class="btn btn-danger" @click=${this.handleReset}>Reset All Rules</button>
        </div>

        ${this.rules.length===0?S`
          <div class="empty-state">No domain boundary overrides learned yet. Interact with the agent proactively to train rules.</div>
        `:S`
          <div class="rule-grid">
            <div class="rule-header">Domain</div>
            <div class="rule-header">Pattern</div>
            <div class="rule-header">Autonomy Tier</div>

            ${this.rules.map(e=>S`
              <div class="rule-row">${e.domain}</div>
              <div class="rule-row">${e.pattern}</div>
              <div class="rule-row">
                <span class="badge badge-${e.tier.toLowerCase()}">${e.tier}</span>
              </div>
            `)}
          </div>
        `}
      </div>

      <div class="panel">
        <div class="panel-title">Proactivity Action Log</div>
        <div class="logs-box">
          ${this.logEntries.length===0?S`
            <div class="empty-state" style="padding: 0.5rem 0;">No proactive actions logged yet.</div>
          `:this.logEntries.map(e=>S`
            <div class="log-line">${e}</div>
          `)}
        </div>
      </div>
    `}};e([A()],J.prototype,`activeAgent`,void 0),e([A()],J.prototype,`config`,void 0),e([A()],J.prototype,`agents`,void 0),e([A()],J.prototype,`wsClient`,void 0),e([A()],J.prototype,`quieter`,void 0),e([A()],J.prototype,`rules`,void 0),e([A()],J.prototype,`logEntries`,void 0),e([A()],J.prototype,`resolvedContextMode`,void 0),e([A()],J.prototype,`activeSignals`,void 0),J=e([k(`autonomy-page`)],J);var Y=class extends O{constructor(...e){super(...e),this.config=null,this.baseHash=``,this.editorMode=`form`,this.rawText=``,this.isSaving=!1,this.conflictDetected=!1,this.serverConfigText=``,this.serverHash=``,this.wsClient=j.getInstance()}static{this.styles=s`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .title {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .panel {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    /* Form Styles */
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-secondary);
    }

    input, select, textarea {
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      padding: 0.55rem 0.7rem;
      outline: none;
      font-size: 0.9rem;
      font-family: var(--font-sans);
    }

    /* Raw textarea editor */
    textarea.raw-textarea {
      font-family: var(--font-mono);
      font-size: 0.85rem;
      min-height: 380px;
      line-height: 1.4;
      white-space: pre;
      resize: vertical;
    }

    .btn {
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 0.5rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      font-size: 0.85rem;
      transition: all 0.2s;
    }

    .btn:hover {
      background-color: var(--border-color);
    }

    .btn-primary {
      background-color: var(--accent-primary);
      border-color: var(--accent-primary);
    }

    .btn-primary:hover {
      opacity: 0.9;
    }

    /* Conflict Layout styles */
    .conflict-banner {
      background-color: var(--status-red-glow);
      border: 1px solid var(--status-red);
      color: var(--text-primary);
      padding: 1rem;
      border-radius: 6px;
      font-size: 0.9rem;
      margin-bottom: 1rem;
    }

    .diff-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-top: 1rem;
    }

    .diff-box {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .diff-box-title {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--accent-secondary);
    }

    .diff-pre {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      padding: 1rem;
      border-radius: 6px;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      max-height: 250px;
      overflow: auto;
      white-space: pre-wrap;
    }
  `}connectedCallback(){super.connectedCallback(),this.loadConfig()}async loadConfig(){try{let e=await this.wsClient.send(`getSystemConfig`);this.config=e.config,this.baseHash=e.hash,this.rawText=JSON.stringify(this.config,null,2),this.conflictDetected=!1}catch(e){console.error(`[ConfigEditor] Failed to load config:`,e)}}updateConfigField(e,t){if(!this.config)return;let n=e.split(`.`),r=this.config;for(let e=0;e<n.length-1;e++)r=r[n[e]];r[n[n.length-1]]=t,this.rawText=JSON.stringify(this.config,null,2),this.requestUpdate()}async saveConfig(e=!1){if(this.isSaving)return;this.isSaving=!0;let t;if(this.editorMode===`raw`)try{t=JSON.parse(this.rawText)}catch(e){alert(`JSON Syntactical Error: ${e.message}`),this.isSaving=!1;return}else t=this.config;try{let n=await this.wsClient.send(`saveSystemConfig`,{config:t,baseHash:e?this.serverHash:this.baseHash});n.conflict?(this.conflictDetected=!0,this.serverConfigText=JSON.stringify(n.config,null,2),this.serverHash=n.hash,alert(`Warning: Configuration has been modified by another process. Review conflict diffs.`)):n.success?(this.baseHash=n.hash,this.conflictDetected=!1,alert(`Configuration saved successfully.`),await this.loadConfig()):alert(`Failed to save configuration.`)}catch(e){alert(`Error: ${e.message}`)}finally{this.isSaving=!1}}render(){return this.config?S`
      <div class="title-row">
        <div class="title">System Configuration Editor</div>
        <div style="display: flex; gap: 0.5rem">
          <button 
            class="btn ${this.editorMode===`form`?`btn-primary`:``}" 
            @click=${()=>this.editorMode=`form`}
          >
            📋 Form UI
          </button>
          <button 
            class="btn ${this.editorMode===`raw`?`btn-primary`:``}" 
            @click=${()=>this.editorMode=`raw`}
          >
            💻 Raw JSON
          </button>
        </div>
      </div>

      ${this.conflictDetected?this.renderConflictView():``}

      <div class="panel">
        ${this.editorMode===`raw`?S`
          <div class="form-group">
            <label for="rawText">Raw Settings JSON File</label>
            <textarea 
              id="rawText" 
              class="raw-textarea"
              .value=${this.rawText}
              @input=${e=>this.rawText=e.target.value}
            ></textarea>
          </div>
        `:S`
          <!-- Form View -->
          <div class="form-grid">
            <div class="form-group">
              <label>Gateway Host Name</label>
              <input 
                type="text" 
                placeholder="127.0.0.1"
                .value=${this.config.gateway?.host??``}
                @input=${e=>this.updateConfigField(`gateway.host`,e.target.value)}
              />
            </div>
            
            <div class="form-group">
              <label>Gateway Port</label>
              <input 
                type="number" 
                placeholder="7328"
                .value=${this.config.gateway?.port??``}
                @input=${e=>this.updateConfigField(`gateway.port`,e.target.value?parseInt(e.target.value,10):``)}
              />
            </div>

            <div class="form-group">
              <label>Authorization Token</label>
              <input 
                type="text" 
                placeholder="Required"
                .value=${this.config.gateway?.authToken??``}
                @input=${e=>this.updateConfigField(`gateway.authToken`,e.target.value)}
              />
            </div>

            <div class="form-group">
              <label>Telegram Shared Token</label>
              <input 
                type="text" 
                placeholder="Optional"
                .value=${this.config.telegram?.sharedToken??``}
                @input=${e=>this.updateConfigField(`telegram.sharedToken`,e.target.value)}
              />
            </div>

            <div class="form-group" style="grid-column: span 2; border-top: 1px solid var(--border-color); padding-top: 1rem; margin-top: 0.5rem">
              <h3 style="margin: 0 0 0.5rem 0; color: #fff; font-size: 0.95rem">Runtime Execution Policy</h3>
              <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.75rem">
                Select target execution harnesses or model overrides for active agents in this fleet configuration.
              </div>
            </div>

            <div class="form-group" style="grid-column: span 2">
              <label>Default Runtime Harness Override</label>
              <select 
                .value=${this.config.agents?.[0]?.model?.agentRuntimeId??`auto`}
                @change=${e=>{if(this.config.agents&&this.config.agents.length>0){for(let t of this.config.agents)t.model||={},t.model.agentRuntimeId=e.target.value;this.rawText=JSON.stringify(this.config,null,2),this.requestUpdate()}}}
              >
                <option value="auto">Auto (Resolved to komorebi)</option>
                <option value="komorebi">komorebi (Embedded OpenClaw Harness)</option>
                <option value="unregistered-test">unregistered-test (Fail-closed simulation)</option>
              </select>
              <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem; line-height: 1.3">
                Precedence: Model-scoped override (\`agentRuntimeId\`) &gt; Provider-scoped override (\`providers[id].agentRuntimeId\`) &gt; Auto-fallback (\`"komorebi"\`). Set to <strong>"unregistered-test"</strong> to simulate fail-closed resolution.
              </div>
            </div>

            <div class="form-group" style="grid-column: span 2; border-top: 1px solid var(--border-color); padding-top: 1rem; margin-top: 0.5rem">
              <h3 style="margin: 0 0 0.5rem 0; color: #fff; font-size: 0.95rem">Message Pipeline Policy</h3>
              <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.75rem">
                Configure debounce delay, command queue behavior (when active runs are steerable or interrupted), and default block-streaming preferences.
              </div>
            </div>

            <div class="form-group">
              <label>Inbound Debounce Delay (ms)</label>
              <input 
                type="number" 
                placeholder="2000"
                .value=${this.config.messages?.inbound?.debounceMs??2e3}
                @input=${e=>{this.config.messages||(this.config.messages={}),this.config.messages.inbound||(this.config.messages.inbound={}),this.config.messages.inbound.debounceMs=parseInt(e.target.value,10)||2e3,this.rawText=JSON.stringify(this.config,null,2)}}
              />
            </div>

            <div class="form-group">
              <label>Command Queue Mode</label>
              <select 
                .value=${this.config.messages?.queue?.default??`followup`}
                @change=${e=>{this.config.messages||(this.config.messages={}),this.config.messages.queue||(this.config.messages.queue={}),this.config.messages.queue.default=e.target.value,this.rawText=JSON.stringify(this.config,null,2)}}
              >
                <option value="followup">Follow-up (Run turns sequentially)</option>
                <option value="steer">Steer (Inject context on active loop)</option>
                <option value="interrupt">Interrupt (Cancel active loop and restart)</option>
                <option value="collect">Collect (Batch turns after completion)</option>
              </select>
            </div>

            <div class="form-group" style="grid-column: span 2">
              <label>Default Block-Streaming Preference</label>
              <select 
                .value=${this.config.agentsDefaults?.blockStreamingDefault?`true`:`false`}
                @change=${e=>{this.config.agentsDefaults||(this.config.agentsDefaults={}),this.config.agentsDefaults.blockStreamingDefault=e.target.value===`true`,this.rawText=JSON.stringify(this.config,null,2)}}
              >
                <option value="false">Off (Complete answers only)</option>
                <option value="true">On (Stream chunks progressively)</option>
              </select>
            </div>
          </div>
        `}

        <div style="display: flex; gap: 0.5rem">
          <button class="btn btn-primary" @click=${()=>this.saveConfig(!1)}>
            ${this.isSaving?`Saving Config...`:`💾 Save Settings`}
          </button>
          <button class="btn" @click=${this.loadConfig}>Reset Changes</button>
        </div>
      </div>
    `:S`<div>Loading configuration editor...</div>`}renderConflictView(){return S`
      <div class="conflict-banner">
        ⚠️ <strong>Concurrency Conflict Detected</strong>: Another client or command-line execution has saved configuration changes since you opened the editor. Please review the differences below and choose whether to force overwrite their changes or reload.
        
        <div class="diff-container">
          <div class="diff-box">
            <div class="diff-box-title">Your Changes</div>
            <pre class="diff-pre">${this.rawText}</pre>
          </div>
          <div class="diff-box-title" style="grid-column: 2">
            Server Version
            <pre class="diff-pre" style="color: var(--status-red)">${this.serverConfigText}</pre>
          </div>
        </div>

        <div style="display: flex; gap: 0.5rem; margin-top: 1rem">
          <button class="btn btn-danger" @click=${()=>this.saveConfig(!0)}>
            💥 Force Overwrite Server
          </button>
          <button class="btn" @click=${this.loadConfig}>
            🔄 Discard & Reload
          </button>
        </div>
      </div>
    `}};e([A()],Y.prototype,`config`,void 0),e([A()],Y.prototype,`baseHash`,void 0),e([A()],Y.prototype,`editorMode`,void 0),e([A()],Y.prototype,`rawText`,void 0),e([A()],Y.prototype,`isSaving`,void 0),e([A()],Y.prototype,`conflictDetected`,void 0),e([A()],Y.prototype,`serverConfigText`,void 0),e([A()],Y.prototype,`serverHash`,void 0),Y=e([k(`config-editor`)],Y);var X=class extends O{constructor(...e){super(...e),this.latencyLogs=[],this.avgLatency=0,this.activeLoops={},this.wsClient=j.getInstance(),this.pollInterval=null}static{this.styles=s`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .title {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .layout {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 1.5rem;
    }

    .panel {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .panel-header {
      font-family: var(--font-display);
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-primary);
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.5rem;
    }

    /* Metric stats */
    .metric {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1.5rem;
      text-align: center;
    }

    .metric-value {
      font-size: 2.2rem;
      font-weight: bold;
      color: var(--accent-secondary);
      font-family: var(--font-mono);
    }

    .metric-label {
      font-size: 0.8rem;
      color: var(--text-secondary);
      text-transform: uppercase;
      margin-top: 0.25rem;
    }

    /* Timing logs table */
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }

    th {
      background-color: var(--bg-tertiary);
      color: var(--text-secondary);
      font-weight: 600;
      font-size: 0.8rem;
      text-transform: uppercase;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border-color);
    }

    td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border-color);
      font-size: 0.85rem;
      font-family: var(--font-sans);
    }

    .badge {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
    }

    .badge.ok {
      background-color: var(--status-green-glow);
      color: var(--status-green);
    }

    .badge.fail {
      background-color: var(--status-red-glow);
      color: var(--status-red);
    }

    code {
      font-family: var(--font-mono);
      font-size: 0.8rem;
      background: var(--bg-primary);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      color: var(--accent-secondary);
    }
  `}connectedCallback(){super.connectedCallback(),this.measureLatency(),this.pollInterval=setInterval(this.measureLatency.bind(this),5e3),this.wsClient.addEventListener(this.handleBusMessage.bind(this))}disconnectedCallback(){super.disconnectedCallback(),this.pollInterval&&clearInterval(this.pollInterval),this.wsClient.removeEventListener(this.handleBusMessage.bind(this))}handleBusMessage(e,t){if(e===`busMessage`&&t.topic===`loop_progress`){let{sessionId:e,event:n}=t.message;if(!e||!n)return;let r=n.agentId||e.split(`:`)[0];if(n.type===`turn_end`){let t={...this.activeLoops};delete t[e],this.activeLoops=t}else{let t=n.loopState;t&&(this.activeLoops={...this.activeLoops,[e]:{agentId:r,sessionId:e,iterationCount:t.iterationCount||0,elapsedTime:t.elapsedTime||0,pendingToolCalls:t.pendingToolCalls||[],lastActive:Date.now()}})}}}async measureLatency(){let e=performance.now(),t=`OK`,n;try{await this.wsClient.send(`listActiveAgents`)}catch(e){t=`FAIL`,n=e.message||`Unknown Error`}finally{let r=Math.round(performance.now()-e),i={id:crypto.randomUUID().slice(0,8),method:`listActiveAgents`,latencyMs:r,timestamp:Date.now(),status:t,error:n};this.latencyLogs=[i,...this.latencyLogs].slice(0,30);let a=this.latencyLogs.filter(e=>e.status===`OK`);a.length>0&&(this.avgLatency=Math.round(a.reduce((e,t)=>e+t.latencyMs,0)/a.length));let o=Date.now(),s={...this.activeLoops},c=!1;for(let[e,t]of Object.entries(s))o-t.lastActive>6e4&&(delete s[e],c=!0);c&&(this.activeLoops=s)}}render(){return S`
      <div class="title">System Timing & Latency Diagnostics</div>

      <div class="layout">
        <!-- Metric panel -->
        <div class="panel">
          <div class="panel-header">Diagnostics Stats</div>
          <div class="metric">
            <div class="metric-value">${this.avgLatency} ms</div>
            <div class="metric-label">Avg WS Latency</div>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4">
            Measures response execution delays for WebSocket RPC frames dispatched between browser dashboard client and user decided gateway port.
          </div>
        </div>

        <!-- Latency log lists -->
        <div class="panel">
          <div class="panel-header">Dispatched API Trace Logs</div>
          <div style="overflow-y: auto; max-height: 400px">
            <table>
              <thead>
                <tr>
                  <th>Trace ID</th>
                  <th>Method Called</th>
                  <th>Latency</th>
                  <th>Timestamp</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                ${this.latencyLogs.map(e=>S`
                  <tr>
                    <td><code>#${e.id}</code></td>
                    <td><strong>${e.method}</strong></td>
                    <td style="font-family: var(--font-mono); font-weight: 500">${e.latencyMs}ms</td>
                    <td>${new Date(e.timestamp).toLocaleTimeString()}</td>
                    <td>
                      <span class="badge ${e.status.toLowerCase()}">${e.status}</span>
                      ${e.error?S`<div style="font-size: 0.75rem; color: var(--status-red); margin-top: 0.2rem">${e.error}</div>`:``}
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Live Active Harness Loops -->
        <div class="panel" style="grid-column: span 2; margin-top: 1rem">
          <div class="panel-header">Live Active Harness Loops (Real-Time)</div>
          <div style="overflow-y: auto; max-height: 250px">
            ${Object.values(this.activeLoops).length===0?S`
              <div style="color: var(--text-secondary); text-align: center; padding: 1.5rem">
                No active execution harness loops currently running.
              </div>
            `:S`
              <table>
                <thead>
                  <tr>
                    <th>Session ID</th>
                    <th>Agent ID</th>
                    <th>Harness ID</th>
                    <th>Harness Resolution Reason</th>
                    <th>Iteration Count</th>
                    <th>Elapsed Time</th>
                    <th>Pending Tool Calls</th>
                  </tr>
                </thead>
                <tbody>
                  ${Object.values(this.activeLoops).map(e=>S`
                    <tr>
                      <td><code>${e.sessionId}</code></td>
                      <td><strong>${e.agentId}</strong></td>
                      <td><code style="color: var(--accent-secondary)">${e.runtime||`komorebi`}</code></td>
                      <td><span style="font-size: 0.8rem; color: var(--text-secondary)">${e.reason||`auto-fallback to built-in komorebi-harness`}</span></td>
                      <td>${e.iterationCount} / 15</td>
                      <td>${e.elapsedTime}s</td>
                      <td>
                        ${e.pendingToolCalls.length===0?S`<span style="color: var(--text-secondary)">None</span>`:e.pendingToolCalls.map(e=>S`
                          <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--accent-secondary)">
                            🛠️ ${e.name}
                          </div>
                        `)}
                      </td>
                    </tr>
                  `)}
                </tbody>
              </table>
            `}
          </div>
        </div>
      </div>
    `}};e([A()],X.prototype,`latencyLogs`,void 0),e([A()],X.prototype,`avgLatency`,void 0),e([A()],X.prototype,`activeLoops`,void 0),X=e([k(`debug-page`)],X);var Z=class extends O{constructor(...e){super(...e),this.logs=[],this.levelFilter=`all`,this.sourceFilter=`all`,this.searchQuery=``,this.wsClient=j.getInstance()}static{this.styles=s`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      height: calc(100vh - 190px);
      overflow: hidden;
    }

    .title {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .panel {
      flex: 1;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .toolbar {
      display: flex;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background-color: var(--bg-tertiary);
      border-bottom: 1px solid var(--border-color);
      align-items: center;
    }

    select, input {
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      padding: 0.4rem 0.6rem;
      outline: none;
      font-size: 0.85rem;
    }

    input {
      flex: 1;
    }

    .terminal {
      flex: 1;
      background-color: #050508;
      padding: 1rem;
      font-family: var(--font-mono);
      font-size: 0.82rem;
      color: #a3c9ae;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .log-line {
      line-height: 1.4;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .log-line.info {
      color: #a3c9ae;
    }

    .log-line.warn {
      color: var(--status-yellow);
    }

    .log-line.error {
      color: var(--status-red);
    }

    .log-time {
      color: var(--text-muted);
      margin-right: 0.5rem;
    }

    .btn {
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.8rem;
      transition: all 0.2s;
    }

    .btn:hover {
      background-color: var(--border-color);
    }
  `}connectedCallback(){super.connectedCallback(),this.wsClient.addEventListener(this.handleBusEvent.bind(this))}disconnectedCallback(){super.disconnectedCallback(),this.wsClient.removeEventListener(this.handleBusEvent.bind(this))}handleBusEvent(e,t){if(e===`busMessage`&&t.topic===`system_logs`){let e=t.message;if(e){let t={id:crypto.randomUUID(),timestamp:e.timestamp||Date.now(),level:e.level||`info`,text:e.text||``};this.logs=[...this.logs,t].slice(-1e3),this.requestUpdate(),setTimeout(()=>{let e=this.shadowRoot?.querySelector(`.terminal`);e&&(e.scrollTop=e.scrollHeight)},10)}}}clearLogs(){this.logs=[]}render(){let e=this.logs.filter(e=>{if(this.levelFilter!==`all`&&e.level!==this.levelFilter)return!1;let t=e.text.includes(`[AgentRuntime`);return this.sourceFilter===`gateway`&&t||this.sourceFilter===`agent`&&!t?!1:!this.searchQuery||e.text.toLowerCase().includes(this.searchQuery.toLowerCase())});return S`
      <div class="title">Live Daemon Logs</div>

      <div class="panel">
        <div class="toolbar">
          <input 
            type="text" 
            placeholder="Search terminal logs..." 
            .value=${this.searchQuery}
            @input=${e=>this.searchQuery=e.target.value}
          />

          <select .value=${this.levelFilter} @change=${e=>this.levelFilter=e.target.value}>
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warnings</option>
            <option value="error">Errors</option>
          </select>

          <select .value=${this.sourceFilter} @change=${e=>this.sourceFilter=e.target.value}>
            <option value="all">All Sources</option>
            <option value="gateway">Gateway Daemon</option>
            <option value="agent">Agent Runtimes</option>
          </select>

          <button class="btn" @click=${this.clearLogs}>🗑️ Clear console</button>
        </div>

        <div class="terminal">
          ${e.length===0?S`
            <div style="color: var(--text-muted); font-style: italic">
              Listening for active console stream lines... (Try sending message to trigger agents)
            </div>
          `:e.map(e=>S`
            <div class="log-line ${e.level}">
              <span class="log-time">[${new Date(e.timestamp).toLocaleTimeString()}]</span>
              <span>${e.text}</span>
            </div>
          `)}
        </div>
      </div>
    `}};e([A()],Z.prototype,`logs`,void 0),e([A()],Z.prototype,`levelFilter`,void 0),e([A()],Z.prototype,`sourceFilter`,void 0),e([A()],Z.prototype,`searchQuery`,void 0),Z=e([k(`logs-page`)],Z);var He={ATTRIBUTE:1,CHILD:2,PROPERTY:3,BOOLEAN_ATTRIBUTE:4,EVENT:5,ELEMENT:6},Ue=e=>(...t)=>({_$litDirective$:e,values:t}),We=class{constructor(e){}get _$AU(){return this._$AM._$AU}_$AT(e,t,n){this._$Ct=e,this._$AM=t,this._$Ci=n}_$AS(e,t){return this.update(e,t)}update(e,t){return this.render(...t)}},Ge=class extends We{constructor(e){if(super(e),this.it=w,e.type!==He.CHILD)throw Error(this.constructor.directiveName+`() can only be used in child bindings`)}render(e){if(e===w||e==null)return this._t=void 0,this.it=e;if(e===C)return e;if(typeof e!=`string`)throw Error(this.constructor.directiveName+`() called with a non-string value`);if(e===this.it)return this._t;this.it=e;let t=[e];return t.raw=t,this._t={_$litType$:this.constructor.resultType,strings:t,values:[]}}};Ge.directiveName=`unsafeHTML`,Ge.resultType=1;var Ke=Ue(Ge),Q=class extends O{constructor(...e){super(...e),this.selectedDoc=`README.md`,this.docContent=`Loading documentation...`,this.docFiles=[`README.md`,`ARCHITECTURE.md`,`SECURITY.md`,`AGENTS.md`,`CLAWHUB-SECURITY.md`],this.wsClient=j.getInstance()}static{this.styles=s`
    :host {
      display: grid;
      grid-template-columns: 200px 1fr;
      gap: 1.5rem;
      height: calc(100vh - 120px);
      font-family: var(--font-display, "Inter", sans-serif);
      color: var(--text-primary);
    }

    .sidebar {
      background: rgba(30, 30, 40, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      backdrop-filter: blur(12px);
    }

    .sidebar-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #9ca3af;
      margin-bottom: 0.5rem;
      font-weight: 700;
      padding-left: 0.5rem;
    }

    .doc-item {
      padding: 0.6rem 0.8rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
      color: #9ca3af;
      transition: all 0.2s;
    }

    .doc-item:hover, .doc-item.active {
      color: #fff;
      background: rgba(255, 255, 255, 0.05);
    }

    .doc-item.active {
      background: rgba(167, 139, 250, 0.15);
      color: #a78bfa;
      border-left: 3px solid #a78bfa;
    }

    .content-panel {
      background: rgba(30, 30, 40, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 2rem;
      overflow-y: auto;
      backdrop-filter: blur(12px);
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      line-height: 1.6;
    }

    /* Markdown Styles */
    .doc-h1 {
      font-size: 1.8rem;
      font-weight: 800;
      margin-bottom: 1rem;
      color: #fff;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 0.5rem;
    }

    .doc-h2 {
      font-size: 1.4rem;
      font-weight: 700;
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
      color: #f3f4f6;
    }

    .doc-h3 {
      font-size: 1.1rem;
      font-weight: 600;
      margin-top: 1rem;
      color: #e5e7eb;
    }

    p {
      margin-bottom: 1rem;
      color: #9ca3af;
      font-size: 0.95rem;
    }

    ul, ol {
      margin-left: 1.5rem;
      margin-bottom: 1rem;
      color: #9ca3af;
      font-size: 0.95rem;
    }

    li {
      margin-bottom: 0.4rem;
    }

    code {
      font-family: monospace;
      background: rgba(0, 0, 0, 0.3);
      padding: 0.15rem 0.3rem;
      border-radius: 4px;
      color: #ec4899;
      font-size: 0.85rem;
    }

    pre {
      background: #09090d;
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 1rem;
      overflow-x: auto;
      margin-bottom: 1rem;
    }

    pre code {
      background: none;
      padding: 0;
      color: #34d399;
    }
  `}connectedCallback(){super.connectedCallback(),this.loadDocContent()}async loadDocContent(){this.docContent=`Loading content...`;let e=this.wsClient.getToken();try{let t=await fetch(`${this.wsClient.getGatewayUrl()}/api/docs/${this.selectedDoc}`,{headers:{Authorization:`Bearer ${e}`}});if(t.ok){let e=await t.json();this.docContent=e.content||`Empty file.`}else this.docContent=`Failed to retrieve documentation: ${t.statusText}`}catch{this.docContent=`Failed to communicate with gateway API.`}}selectDoc(e){this.selectedDoc=e,this.loadDocContent()}parseMarkdown(e){if(!e)return``;let t=e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`);return t=t.replace(/```([\s\S]*?)```/g,(e,t)=>`<pre><code>${t.trim()}</code></pre>`),t=t.replace(/^#\s+(.+)$/gm,`<h1 class="doc-h1">$1</h1>`),t=t.replace(/^##\s+(.+)$/gm,`<h2 class="doc-h2">$1</h2>`),t=t.replace(/^###\s+(.+)$/gm,`<h3 class="doc-h3">$1</h3>`),t=t.replace(/\*\*([^*]+)\*\*/g,`<strong>$1</strong>`),t=t.replace(/`([^`]+)`/g,`<code>$1</code>`),t=t.replace(/^\s*-\s+(.+)$/gm,`<li>$1</li>`),t=t.replace(/^\s*\*\s+(.+)$/gm,`<li>$1</li>`),t=t.replace(/\n\n/g,`<br/>`),t}render(){return S`
      <div class="sidebar">
        <div class="sidebar-title">Documents</div>
        ${this.docFiles.map(e=>S`
          <div class="doc-item ${this.selectedDoc===e?`active`:``}" @click=${()=>this.selectDoc(e)}>
            📄 ${e.replace(`.md`,``)}
          </div>
        `)}
      </div>

      <div class="content-panel">
        ${Ke(this.parseMarkdown(this.docContent))}
      </div>
    `}};e([A()],Q.prototype,`selectedDoc`,void 0),e([A()],Q.prototype,`docContent`,void 0),e([A()],Q.prototype,`docFiles`,void 0),Q=e([k(`docs-page`)],Q),typeof window<`u`&&(window.crypto||(window.crypto={}),window.crypto.randomUUID||(window.crypto.randomUUID=function(){return`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g,e=>{let t=Math.random()*16|0;return(e===`x`?t:t&3|8).toString(16)})}));var $=class extends O{constructor(...e){super(...e),this.activeRoute=`overview`,this.activeRouteSecondary=`chat`,this.splitView=!1,this.wsStatus=`disconnected`,this.activeTheme=`dark`,this.sidebarCollapsed=!1,this.mobileMenuOpen=!1,this.paletteOpen=!1,this.paletteSearch=``,this.selectedPaletteIndex=0,this.isDragging=!1,this.leftPaneWidth=50,this.wsClient=j.getInstance(),this.menuItems=[{id:`overview`,name:`System Overview`,category:`Control`,icon:`📊`,tag:`overview-page`},{id:`health`,name:`System Health & Watchdog`,category:`Control`,icon:`🛡️`,tag:`health-page`},{id:`self-healing`,name:`Self-Healing Center`,category:`Control`,icon:`🩹`,tag:`self-healing-page`},{id:`channels`,name:`Channels Setup`,category:`Control`,icon:`🔌`,tag:`channels-page`},{id:`instances`,name:`Agent Instances`,category:`Control`,icon:`⚙️`,tag:`instances-page`},{id:`sessions`,name:`Sessions Logs`,category:`Control`,icon:`📁`,tag:`sessions-page`},{id:`cron`,name:`Scheduled Cron Jobs`,category:`Control`,icon:`⏱️`,tag:`cron-page`},{id:`chat`,name:`Direct Chat Console`,category:`Chat`,icon:`💬`,tag:`chat-page`},{id:`agents-manager`,name:`Agents Registry`,category:`Agents`,icon:`🤖`,tag:`agents-manager`},{id:`teams-manager`,name:`Teams Registry`,category:`Agents`,icon:`👥`,tag:`teams-manager`},{id:`agent-files`,name:`Agent Files Editor`,category:`Agents`,icon:`📝`,tag:`agent-files`},{id:`models-manager`,name:`Providers & Models`,category:`Agents`,icon:`🧠`,tag:`models-manager`},{id:`advanced-panel`,name:`Advanced AI Settings`,category:`Agents`,icon:`🧠`,tag:`advanced-panel`},{id:`skills`,name:`Skills Pack Manager`,category:`Agents`,icon:`🧰`,tag:`skills-page`},{id:`autonomy`,name:`Autonomy & Boundaries`,category:`Agents`,icon:`🧠`,tag:`autonomy-page`},{id:`nodes`,name:`Pipeline Nodes`,category:`Agents`,icon:`⛓️`,tag:`nodes-page`},{id:`bus-monitor`,name:`Event Bus Monitor`,category:`Agents`,icon:`📡`,tag:`bus-monitor-page`},{id:`config`,name:`Config Editor`,category:`Settings`,icon:`🛠️`,tag:`config-editor`},{id:`debug`,name:`Latencies Debug`,category:`Settings`,icon:`🐛`,tag:`debug-page`},{id:`logs`,name:`Live Terminal Logs`,category:`Settings`,icon:`📝`,tag:`logs-page`},{id:`docs`,name:`Documentation Site`,category:`Resources`,icon:`📖`,tag:`docs-page`}]}static{this.styles=s`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
      position: relative;
    }

    /* Background Glowing Blurs (Cyberpunk style) */
    .glow-blur {
      position: absolute;
      width: 30vw;
      height: 30vw;
      border-radius: 50%;
      filter: blur(150px);
      pointer-events: none;
      z-index: -1;
      opacity: 0.15;
    }

    .glow-left {
      top: 10%;
      left: 5%;
      background: var(--accent-primary);
    }

    .glow-right {
      bottom: 10%;
      right: 5%;
      background: var(--accent-secondary);
    }

    /* Core Shell Grid */
    .shell-container {
      display: flex;
      height: 100%;
      width: 100%;
      position: relative;
      background: transparent;
      z-index: 1;
    }

    /* Sidebar Styles */
    .sidebar {
      width: var(--sidebar-width);
      background-color: var(--bg-secondary);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      transition: width var(--transition-speed) ease;
      z-index: 10;
    }

    .sidebar.collapsed {
      width: 60px;
    }

    .sidebar-header {
      height: var(--header-height);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1rem;
      border-bottom: 1px solid var(--border-color);
    }

    .logo {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 1.15rem;
      letter-spacing: 1px;
      color: var(--accent-secondary);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      white-space: nowrap;
      overflow: hidden;
    }

    .sidebar.collapsed .logo {
      display: none;
    }

    .logo-dot {
      width: 8px;
      height: 8px;
      background: var(--accent-primary);
      border-radius: 50%;
    }

    .sidebar-menu {
      flex: 1;
      overflow-y: auto;
      padding: 1rem 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .category-title {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: var(--text-muted);
      padding-left: 0.75rem;
      margin-bottom: 0.25rem;
    }

    .sidebar.collapsed .category-title {
      display: none;
    }

    .nav-list {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.6rem 0.75rem;
      border-radius: var(--border-radius);
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--transition-speed) ease;
    }

    .nav-item:hover {
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
    }

    .nav-item.active {
      background-color: var(--accent-glow);
      color: var(--text-primary);
      border-left: 3px solid var(--accent-primary);
    }

    .nav-icon {
      font-size: 1.1rem;
    }

    .sidebar.collapsed .nav-item {
      justify-content: center;
      padding: 0.6rem 0;
    }

    .sidebar.collapsed .nav-text {
      display: none;
    }

    /* Main Area Header & Container */
    .main-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      background-color: var(--bg-primary);
      overflow: hidden;
      position: relative;
    }

    .header-bar {
      height: var(--header-height);
      background-color: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1.5rem;
      z-index: 5;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .header-title {
      font-family: var(--font-display);
      font-weight: 600;
      font-size: 1.1rem;
      color: var(--text-primary);
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    /* Status badge styling */
    .health-badge {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.8rem;
      font-weight: 600;
      padding: 0.25rem 0.6rem;
      border-radius: 20px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
    }

    .health-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }

    .health-dot.connected {
      background-color: var(--status-green);
      animation: pulseGlow 1.5s infinite;
    }

    .health-dot.connecting {
      background-color: var(--status-yellow);
    }

    .health-dot.disconnected {
      background-color: var(--status-red);
      animation: pulseRedGlow 1.5s infinite;
    }

    /* Split-Pane Content Container */
    .content-panes {
      flex: 1;
      display: flex;
      overflow: hidden;
      position: relative;
    }

    .pane {
      height: 100%;
      overflow-y: auto;
      position: relative;
    }

    .pane-content {
      padding: 1.5rem;
      min-height: 100%;
    }

    /* Drag Divider */
    .divider {
      width: 6px;
      background-color: var(--border-color);
      cursor: col-resize;
      transition: background-color 0.2s;
      position: relative;
      z-index: 10;
    }

    .divider:hover, .divider.active {
      background-color: var(--accent-primary);
    }

    /* Control Panel Toggles */
    .btn {
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      transition: all 0.2s;
    }

    .btn:hover {
      background-color: var(--border-color);
    }

    .btn.active {
      background-color: var(--accent-primary);
      border-color: var(--accent-primary);
    }

    .palette-hint {
      font-size: 0.75rem;
      color: var(--text-muted);
      border: 1px solid var(--border-color);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      background: var(--bg-primary);
    }

    /* Theme selector */
    .theme-select {
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 0.4rem;
      border-radius: 6px;
      cursor: pointer;
    }

    /* Command Palette Overlay */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      z-index: 100;
      display: flex;
      justify-content: center;
      padding-top: 10vh;
    }

    .palette-box {
      width: 550px;
      max-height: 400px;
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .palette-search-input {
      width: 100%;
      background: var(--bg-primary);
      border: none;
      border-bottom: 1px solid var(--border-color);
      color: var(--text-primary);
      padding: 1rem;
      font-size: 1rem;
      font-family: var(--font-sans);
      outline: none;
    }

    .palette-results {
      flex: 1;
      overflow-y: auto;
      padding: 0.5rem;
    }

    .palette-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      border-radius: var(--border-radius);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.15s;
    }

    .palette-item:hover, .palette-item.selected {
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
    }

    .palette-item-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .palette-category {
      font-size: 0.7rem;
      background: var(--bg-primary);
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      color: var(--text-muted);
      border: 1px solid var(--border-color);
    }

    /* Mobile Hamburger drawer styles */
    .menu-toggle {
      display: none;
    }

    .sidebar-close {
      display: none;
    }

    @media (max-width: 768px) {
      .menu-toggle {
        display: block;
      }
      
      .sidebar {
        position: absolute;
        left: -100%;
        top: 0;
        bottom: 0;
        width: 260px;
        transition: left var(--transition-speed) ease;
      }

      .sidebar.mobile-open {
        left: 0;
      }

      .sidebar-close {
        display: block;
      }

      .divider {
        display: none;
      }

      .content-panes {
        flex-direction: column;
      }

      .pane {
        width: 100% !important;
        height: 50% !important;
      }

      .palette-box {
        width: 90vw;
      }
    }
  `}connectedCallback(){super.connectedCallback(),this.wsClient.addStatusListener(this.handleWsStatus.bind(this)),window.addEventListener(`keydown`,this.handleKeydown.bind(this)),window.addEventListener(`mousemove`,this.handleMousemove.bind(this)),window.addEventListener(`mouseup`,this.handleMouseup.bind(this));let e=localStorage.getItem(`komorebi_theme`)||`dark`;this.setTheme(e)}disconnectedCallback(){super.disconnectedCallback(),this.wsClient.removeStatusListener(this.handleWsStatus.bind(this)),window.removeEventListener(`keydown`,this.handleKeydown.bind(this)),window.removeEventListener(`mousemove`,this.handleMousemove.bind(this)),window.removeEventListener(`mouseup`,this.handleMouseup.bind(this))}handleWsStatus(e){this.wsStatus=e}setTheme(e){this.activeTheme=e,localStorage.setItem(`komorebi_theme`,e),document.documentElement.setAttribute(`theme`,e)}handleKeydown(e){if((e.ctrlKey||e.metaKey)&&e.key===`k`)e.preventDefault(),this.paletteOpen=!this.paletteOpen,this.paletteSearch=``,this.selectedPaletteIndex=0;else if(e.key===`Escape`)this.paletteOpen=!1;else if(this.paletteOpen){let t=this.getFilteredPaletteItems();e.key===`ArrowDown`?(e.preventDefault(),this.selectedPaletteIndex=(this.selectedPaletteIndex+1)%t.length):e.key===`ArrowUp`?(e.preventDefault(),this.selectedPaletteIndex=(this.selectedPaletteIndex-1+t.length)%t.length):e.key===`Enter`&&(e.preventDefault(),t[this.selectedPaletteIndex]&&this.navigate(t[this.selectedPaletteIndex].id))}}navigate(e,t=!1){t?this.activeRouteSecondary=e:this.activeRoute=e,this.paletteOpen=!1,this.mobileMenuOpen=!1}getFilteredPaletteItems(){if(!this.paletteSearch)return this.menuItems;let e=this.paletteSearch.toLowerCase();return this.menuItems.filter(t=>t.name.toLowerCase().includes(e)||t.category.toLowerCase().includes(e))}startDragging(e){e.preventDefault(),this.isDragging=!0,this.shadowRoot?.querySelector(`.divider`)?.classList.add(`active`)}handleMousemove(e){if(!this.isDragging)return;let t=this.shadowRoot?.querySelector(`.content-panes`);if(!t)return;let n=t.getBoundingClientRect(),r=(e.clientX-n.left)/n.width*100;this.leftPaneWidth=Math.max(15,Math.min(85,r))}handleMouseup(){this.isDragging&&(this.isDragging=!1,this.shadowRoot?.querySelector(`.divider`)?.classList.remove(`active`))}render(){let e=this.getFilteredPaletteItems(),t=Array.from(new Set(this.menuItems.map(e=>e.category)));return S`
      <div class="glow-blur glow-left"></div>
      <div class="glow-blur glow-right"></div>
      <div class="shell-container">
        <!-- Sidebar Drawer -->
        <aside class="sidebar ${this.sidebarCollapsed?`collapsed`:``} ${this.mobileMenuOpen?`mobile-open`:``}">
          <div class="sidebar-header">
            <div class="logo">
              <div class="logo-dot"></div>
              <span>KOMOREBI OMOI</span>
            </div>
            <button class="btn sidebar-close" @click=${()=>this.mobileMenuOpen=!1}>✕</button>
            <button class="btn" style="padding: 0.25rem 0.5rem" @click=${()=>this.sidebarCollapsed=!this.sidebarCollapsed}>
              ${this.sidebarCollapsed?`▶`:`◀`}
            </button>
          </div>
          
          <div class="sidebar-menu">
            ${t.map(e=>S`
              <div>
                <div class="category-title">${e}</div>
                <div class="nav-list">
                  ${this.menuItems.filter(t=>t.category===e).map(e=>S`
                    <div 
                      class="nav-item ${this.activeRoute===e.id?`active`:``}" 
                      @click=${()=>this.navigate(e.id)}
                    >
                      <span class="nav-icon">${e.icon}</span>
                      <span class="nav-text">${e.name}</span>
                    </div>
                  `)}
                </div>
              </div>
            `)}
          </div>
        </aside>

        <!-- Main Display Container -->
        <div class="main-area">
          <header class="header-bar">
            <div class="header-left">
              <button class="btn menu-toggle" @click=${()=>this.mobileMenuOpen=!0}>☰</button>
              <div class="header-title">CONTROL INTERFACE</div>
            </div>
            
            <div class="header-right">
              <!-- Split Screen Toggle -->
              <button class="btn ${this.splitView?`active`:``}" @click=${()=>this.splitView=!this.splitView}>
                🪟 Split Multitask
              </button>
              
              <!-- Command Palette trigger hint -->
              <div class="btn" @click=${()=>this.paletteOpen=!0}>
                🔍 <span class="palette-hint">Ctrl + K</span> Search
              </div>

              <!-- Theme Selector -->
              <select class="theme-select" .value=${this.activeTheme} @change=${e=>this.setTheme(e.target.value)}>
                <option value="dark">🌙 Dark Slate</option>
                <option value="light">☀️ Clinic Light</option>
                <option value="komorebi">🌲 Forest Glow</option>
              </select>

              <!-- Health Check Badge -->
              <div class="health-badge" style="cursor: pointer" @click=${this.reenterToken} title="Click to change Access Token">
                <span class="health-dot ${this.wsStatus}"></span>
                <span>${this.wsStatus.toUpperCase()}</span>
              </div>
            </div>
          </header>

          <!-- Client-side Page Router Mounting -->
          <div class="content-panes">
            <!-- Left / Primary Pane -->
            <div class="pane" style="width: ${this.splitView?this.leftPaneWidth+`%`:`100%`}">
              <div class="pane-content">
                ${this.renderPage(this.activeRoute)}
              </div>
            </div>

            <!-- Resize Divider -->
            ${this.splitView?S`
              <div class="divider" @mousedown=${this.startDragging}></div>
              
              <!-- Right / Secondary Pane -->
              <div class="pane" style="width: ${100-this.leftPaneWidth+`%`}">
                <div class="pane-content" style="border-left: 1px solid var(--border-color)">
                  <div style="margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between">
                    <span style="font-weight: 600; color: var(--accent-secondary)">Secondary multitask workspace</span>
                    <select class="theme-select" style="padding: 0.2rem" .value=${this.activeRouteSecondary} @change=${e=>this.navigate(e.target.value,!0)}>
                      ${this.menuItems.map(e=>S`<option value=${e.id}>${e.name}</option>`)}
                    </select>
                  </div>
                  ${this.renderPage(this.activeRouteSecondary)}
                </div>
              </div>
            `:``}
          </div>
        </div>
      </div>

      <!-- Command Palette Overlay -->
      ${this.paletteOpen?S`
        <div class="modal-overlay" @click=${()=>this.paletteOpen=!1}>
          <div class="palette-box" @click=${e=>e.stopPropagation()}>
            <input 
              type="text" 
              class="palette-search-input" 
              placeholder="Search actions, files, configurations..." 
              .value=${this.paletteSearch}
              @input=${e=>{this.paletteSearch=e.target.value,this.selectedPaletteIndex=0}}
              autofocus
            />
            <div class="palette-results">
              ${e.length===0?S`
                <div style="padding: 1rem; text-align: center; color: var(--text-muted)">
                  No results found matching search string
                </div>
              `:e.map((e,t)=>S`
                <div 
                  class="palette-item ${this.selectedPaletteIndex===t?`selected`:``}"
                  @click=${()=>this.navigate(e.id)}
                  @mouseenter=${()=>this.selectedPaletteIndex=t}
                >
                  <div class="palette-item-left">
                    <span>${e.icon}</span>
                    <span>${e.name}</span>
                  </div>
                  <span class="palette-category">${e.category}</span>
                </div>
              `)}
            </div>
          </div>
        </div>
      `:``}
    `}reenterToken(){let e=window.prompt(`Enter new Gateway Access Token:`,this.wsClient.getToken());e!==null&&(this.wsClient.setToken(e.trim()),window.location.reload())}renderPage(e){switch(e){case`overview`:return S`<overview-page></overview-page>`;case`health`:return S`<health-page></health-page>`;case`self-healing`:return S`<self-healing-page></self-healing-page>`;case`channels`:return S`<channels-page></channels-page>`;case`instances`:return S`<instances-page></instances-page>`;case`sessions`:return S`<sessions-page></sessions-page>`;case`cron`:return S`<cron-page></cron-page>`;case`chat`:return S`<chat-page></chat-page>`;case`agents-manager`:return S`<agents-manager></agents-manager>`;case`teams-manager`:return S`<teams-manager></teams-manager>`;case`agent-files`:return S`<agent-files></agent-files>`;case`models-manager`:return S`<models-manager></models-manager>`;case`advanced-panel`:return S`<advanced-panel></advanced-panel>`;case`skills`:return S`<skills-page></skills-page>`;case`autonomy`:return S`<autonomy-page></autonomy-page>`;case`nodes`:return S`<nodes-page></nodes-page>`;case`bus-monitor`:return S`<bus-monitor-page></bus-monitor-page>`;case`config`:return S`<config-editor></config-editor>`;case`debug`:return S`<debug-page></debug-page>`;case`logs`:return S`<logs-page></logs-page>`;case`docs`:return S`<docs-page></docs-page>`;default:return S`<overview-page></overview-page>`}}};e([A()],$.prototype,`activeRoute`,void 0),e([A()],$.prototype,`activeRouteSecondary`,void 0),e([A()],$.prototype,`splitView`,void 0),e([A()],$.prototype,`wsStatus`,void 0),e([A()],$.prototype,`activeTheme`,void 0),e([A()],$.prototype,`sidebarCollapsed`,void 0),e([A()],$.prototype,`mobileMenuOpen`,void 0),e([A()],$.prototype,`paletteOpen`,void 0),e([A()],$.prototype,`paletteSearch`,void 0),e([A()],$.prototype,`selectedPaletteIndex`,void 0),e([A()],$.prototype,`leftPaneWidth`,void 0),$=e([k(`app-shell`)],$);