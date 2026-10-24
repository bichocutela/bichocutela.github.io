import"./index.esm-P2RtLDqV.js";import{getAuth as K}from"./index.esm-BuoVvrBa.js";import{g as S,k as j,d as q,l as W,m as G,p as z,n as X,f as Y,C as Z,r as y,S as J,e as Q,F as ee,a as te,i as se}from"./index.esm-BUtioaLU.js";import{getFirestore as ne}from"./index.esm-Bn5FyhlU.js";/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const M="firebasestorage.googleapis.com",ie="storageBucket",oe=120*1e3,re=600*1e3;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class f extends ee{constructor(t,s,n=0){super(U(t),`Firebase Storage: ${s} (${U(t)})`),this.status_=n,this.customData={serverResponse:null},this._baseMessage=this.message,Object.setPrototypeOf(this,f.prototype)}get status(){return this.status_}set status(t){this.status_=t}_codeEquals(t){return U(t)===this.code}get serverResponse(){return this.customData.serverResponse}set serverResponse(t){this.customData.serverResponse=t,this.customData.serverResponse?this.message=`${this._baseMessage}
${this.customData.serverResponse}`:this.message=this._baseMessage}}var _;(function(e){e.UNKNOWN="unknown",e.OBJECT_NOT_FOUND="object-not-found",e.BUCKET_NOT_FOUND="bucket-not-found",e.PROJECT_NOT_FOUND="project-not-found",e.QUOTA_EXCEEDED="quota-exceeded",e.UNAUTHENTICATED="unauthenticated",e.UNAUTHORIZED="unauthorized",e.UNAUTHORIZED_APP="unauthorized-app",e.RETRY_LIMIT_EXCEEDED="retry-limit-exceeded",e.INVALID_CHECKSUM="invalid-checksum",e.CANCELED="canceled",e.INVALID_EVENT_NAME="invalid-event-name",e.INVALID_URL="invalid-url",e.INVALID_DEFAULT_BUCKET="invalid-default-bucket",e.NO_DEFAULT_BUCKET="no-default-bucket",e.CANNOT_SLICE_BLOB="cannot-slice-blob",e.SERVER_FILE_WRONG_SIZE="server-file-wrong-size",e.NO_DOWNLOAD_URL="no-download-url",e.INVALID_ARGUMENT="invalid-argument",e.INVALID_ARGUMENT_COUNT="invalid-argument-count",e.APP_DELETED="app-deleted",e.INVALID_ROOT_OPERATION="invalid-root-operation",e.INVALID_FORMAT="invalid-format",e.INTERNAL_ERROR="internal-error",e.UNSUPPORTED_ENVIRONMENT="unsupported-environment"})(_||(_={}));function U(e){return"storage/"+e}function ae(){const e="An unknown error occurred, please check the error payload for server response.";return new f(_.UNKNOWN,e)}function ce(){return new f(_.RETRY_LIMIT_EXCEEDED,"Max retry time for operation exceeded, please try again.")}function le(){return new f(_.CANCELED,"User canceled the upload/download.")}function ue(e){return new f(_.INVALID_URL,"Invalid URL '"+e+"'.")}function he(e){return new f(_.INVALID_DEFAULT_BUCKET,"Invalid default bucket '"+e+"'.")}function P(e){return new f(_.INVALID_ARGUMENT,e)}function V(){return new f(_.APP_DELETED,"The Firebase app was deleted.")}function pe(e){return new f(_.INVALID_ROOT_OPERATION,"The operation '"+e+"' cannot be performed on a root reference, create a non-root reference using child, such as .child('file.png').")}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class d{constructor(t,s){this.bucket=t,this.path_=s}get path(){return this.path_}get isRoot(){return this.path.length===0}fullServerUrl(){const t=encodeURIComponent;return"/b/"+t(this.bucket)+"/o/"+t(this.path)}bucketOnlyServerUrl(){return"/b/"+encodeURIComponent(this.bucket)+"/o"}static makeFromBucketSpec(t,s){let n;try{n=d.makeFromUrl(t,s)}catch{return new d(t,"")}if(n.path==="")return n;throw he(t)}static makeFromUrl(t,s){let n=null;const i="([A-Za-z0-9.\\-_]+)";function o(p){p.path.charAt(p.path.length-1)==="/"&&(p.path_=p.path_.slice(0,-1))}const a="(/(.*))?$",c=new RegExp("^gs://"+i+a,"i"),r={bucket:1,path:3};function l(p){p.path_=decodeURIComponent(p.path)}const u="v[A-Za-z0-9_]+",g=s.replace(/[.]/g,"\\."),m="(/([^?#]*).*)?$",b=new RegExp(`^https?://${g}/${u}/b/${i}/o${m}`,"i"),R={bucket:1,path:3},k=s===M?"(?:storage.googleapis.com|storage.cloud.google.com)":s,h="([^?#]*)",I=new RegExp(`^https?://${k}/${i}/${h}`,"i"),T=[{regex:c,indices:r,postModify:o},{regex:b,indices:R,postModify:l},{regex:I,indices:{bucket:1,path:2},postModify:l}];for(let p=0;p<T.length;p++){const E=T[p],v=E.regex.exec(t);if(v){const H=v[E.indices.bucket];let D=v[E.indices.path];D||(D=""),n=new d(H,D),E.postModify(n);break}}if(n==null)throw ue(t);return n}}class de{constructor(t){this.promise_=Promise.reject(t)}getPromise(){return this.promise_}cancel(t=!1){}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function _e(e,t,s){let n=1,i=null,o=null,a=!1,c=0;function r(){return c===2}let l=!1;function u(...h){l||(l=!0,t.apply(null,h))}function g(h){i=setTimeout(()=>{i=null,e(b,r())},h)}function m(){o&&clearTimeout(o)}function b(h,...I){if(l){m();return}if(h){m(),u.call(null,h,...I);return}if(r()||a){m(),u.call(null,h,...I);return}n<64&&(n*=2);let T;c===1?(c=2,T=0):T=(n+Math.random())*1e3,g(T)}let R=!1;function k(h){R||(R=!0,m(),!l&&(i!==null?(h||(c=2),clearTimeout(i),g(0)):h||(c=1)))}return g(0),o=setTimeout(()=>{a=!0,k(!0)},s),k}function fe(e){e(!1)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function me(e){return e!==void 0}function C(e,t,s,n){if(n<t)throw P(`Invalid value for '${e}'. Expected ${t} or greater.`);if(n>s)throw P(`Invalid value for '${e}'. Expected ${s} or less.`)}function ge(e){const t=encodeURIComponent;let s="?";for(const n in e)if(e.hasOwnProperty(n)){const i=t(n)+"="+t(e[n]);s=s+i+"&"}return s=s.slice(0,-1),s}var O;(function(e){e[e.NO_ERROR=0]="NO_ERROR",e[e.NETWORK_ERROR=1]="NETWORK_ERROR",e[e.ABORT=2]="ABORT"})(O||(O={}));/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Re(e,t){const s=e>=500&&e<600,i=[408,429].indexOf(e)!==-1,o=t.indexOf(e)!==-1;return s||i||o}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ke{constructor(t,s,n,i,o,a,c,r,l,u,g,m=!0,b=!1){this.url_=t,this.method_=s,this.headers_=n,this.body_=i,this.successCodes_=o,this.additionalRetryCodes_=a,this.callback_=c,this.errorCallback_=r,this.timeout_=l,this.progressCallback_=u,this.connectionFactory_=g,this.retry=m,this.isUsingEmulator=b,this.pendingConnection_=null,this.backoffId_=null,this.canceled_=!1,this.appDelete_=!1,this.promise_=new Promise((R,k)=>{this.resolve_=R,this.reject_=k,this.start_()})}start_(){const t=(n,i)=>{if(i){n(!1,new A(!1,null,!0));return}const o=this.connectionFactory_();this.pendingConnection_=o;const a=c=>{const r=c.loaded,l=c.lengthComputable?c.total:-1;this.progressCallback_!==null&&this.progressCallback_(r,l)};this.progressCallback_!==null&&o.addUploadProgressListener(a),o.send(this.url_,this.method_,this.isUsingEmulator,this.body_,this.headers_).then(()=>{this.progressCallback_!==null&&o.removeUploadProgressListener(a),this.pendingConnection_=null;const c=o.getErrorCode()===O.NO_ERROR,r=o.getStatus();if(!c||Re(r,this.additionalRetryCodes_)&&this.retry){const u=o.getErrorCode()===O.ABORT;n(!1,new A(!1,null,u));return}const l=this.successCodes_.indexOf(r)!==-1;n(!0,new A(l,o))})},s=(n,i)=>{const o=this.resolve_,a=this.reject_,c=i.connection;if(i.wasSuccessCode)try{const r=this.callback_(c,c.getResponse());me(r)?o(r):o()}catch(r){a(r)}else if(c!==null){const r=ae();r.serverResponse=c.getErrorText(),this.errorCallback_?a(this.errorCallback_(c,r)):a(r)}else if(i.canceled){const r=this.appDelete_?V():le();a(r)}else{const r=ce();a(r)}};this.canceled_?s(!1,new A(!1,null,!0)):this.backoffId_=_e(t,s,this.timeout_)}getPromise(){return this.promise_}cancel(t){this.canceled_=!0,this.appDelete_=t||!1,this.backoffId_!==null&&fe(this.backoffId_),this.pendingConnection_!==null&&this.pendingConnection_.abort()}}class A{constructor(t,s,n){this.wasSuccessCode=t,this.connection=s,this.canceled=!!n}}function Te(e,t){t!==null&&t.length>0&&(e.Authorization="Firebase "+t)}function be(e,t){e["X-Firebase-Storage-Version"]="webjs/"+(t??"AppManager")}function Ie(e,t){t&&(e["X-Firebase-GMPID"]=t)}function Ee(e,t){t!==null&&(e["X-Firebase-AppCheck"]=t)}function Ae(e,t,s,n,i,o,a=!0,c=!1){const r=ge(e.urlParams),l=e.url+r,u=Object.assign({},e.headers);return Ie(u,t),Te(u,s),be(u,o),Ee(u,n),new ke(l,e.method,u,e.body,e.successCodes,e.additionalRetryCodes,e.handler,e.errorHandler,e.timeout,e.progressCallback,i,a,c)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Oe(e){if(e.length===0)return null;const t=e.lastIndexOf("/");return t===-1?"":e.slice(0,t)}function Ne(e){const t=e.lastIndexOf("/",e.length-2);return t===-1?e:e.slice(t+1)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class N{constructor(t,s){this._service=t,s instanceof d?this._location=s:this._location=d.makeFromUrl(s,t.host)}toString(){return"gs://"+this._location.bucket+"/"+this._location.path}_newRef(t,s){return new N(t,s)}get root(){const t=new d(this._location.bucket,"");return this._newRef(this._service,t)}get bucket(){return this._location.bucket}get fullPath(){return this._location.path}get name(){return Ne(this._location.path)}get storage(){return this._service}get parent(){const t=Oe(this._location.path);if(t===null)return null;const s=new d(this._location.bucket,t);return new N(this._service,s)}_throwIfRoot(t){if(this._location.path==="")throw pe(t)}}function x(e,t){const s=t?.[ie];return s==null?null:d.makeFromBucketSpec(s,e)}function ve(e,t,s,n={}){e.host=`${t}:${s}`;const i=G(t);i&&z(`https://${e.host}/b`),e._isUsingEmulator=!0,e._protocol=i?"https":"http";const{mockUserToken:o}=n;o&&(e._overrideAuthToken=typeof o=="string"?o:X(o,e.app.options.projectId))}class De{constructor(t,s,n,i,o,a=!1){this.app=t,this._authProvider=s,this._appCheckProvider=n,this._url=i,this._firebaseVersion=o,this._isUsingEmulator=a,this._bucket=null,this._host=M,this._protocol="https",this._appId=null,this._deleted=!1,this._maxOperationRetryTime=oe,this._maxUploadRetryTime=re,this._requests=new Set,i!=null?this._bucket=d.makeFromBucketSpec(i,this._host):this._bucket=x(this._host,this.app.options)}get host(){return this._host}set host(t){this._host=t,this._url!=null?this._bucket=d.makeFromBucketSpec(this._url,t):this._bucket=x(t,this.app.options)}get maxUploadRetryTime(){return this._maxUploadRetryTime}set maxUploadRetryTime(t){C("time",0,Number.POSITIVE_INFINITY,t),this._maxUploadRetryTime=t}get maxOperationRetryTime(){return this._maxOperationRetryTime}set maxOperationRetryTime(t){C("time",0,Number.POSITIVE_INFINITY,t),this._maxOperationRetryTime=t}async _getAuthToken(){if(this._overrideAuthToken)return this._overrideAuthToken;const t=this._authProvider.getImmediate({optional:!0});if(t){const s=await t.getToken();if(s!==null)return s.accessToken}return null}async _getAppCheckToken(){if(Q(this.app)&&this.app.settings.appCheckToken)return this.app.settings.appCheckToken;const t=this._appCheckProvider.getImmediate({optional:!0});return t?(await t.getToken()).token:null}_delete(){return this._deleted||(this._deleted=!0,this._requests.forEach(t=>t.cancel()),this._requests.clear()),Promise.resolve()}_makeStorageReference(t){return new N(this,t)}_makeRequest(t,s,n,i,o=!0){if(this._deleted)return new de(V());{const a=Ae(t,this._appId,n,i,s,this._firebaseVersion,o,this._isUsingEmulator);return this._requests.add(a),a.getPromise().then(()=>this._requests.delete(a),()=>this._requests.delete(a)),a}}async makeRequestWithTokens(t,s){const[n,i]=await Promise.all([this._getAuthToken(),this._getAppCheckToken()]);return this._makeRequest(t,s,n,i).getPromise()}}const L="@firebase/storage",F="0.14.5";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const $="storage";function Ue(e=S(),t){e=j(e);const n=q(e,$).getImmediate({identifier:t}),i=W("storage");return i&&we(n,...i),n}function we(e,t,s,n={}){ve(e,t,s,n)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ye(e,{instanceIdentifier:t}){const s=e.getProvider("app").getImmediate(),n=e.getProvider("auth-internal"),i=e.getProvider("app-check-internal");return new De(s,n,i,t,J)}function Pe(){Y(new Z($,ye,"PUBLIC").setMultipleInstances(!0)),y(L,F,""),y(L,F,"esm2020")}Pe();const Ce={apiKey:"AIzaSyA6oHEJzOH3m4j8CuMWoXlceQKSy8Viqmw",authDomain:"appcodigo-7f245.firebaseapp.com",projectId:"appcodigo-7f245",storageBucket:"appcodigo-7f245.firebasestorage.app",messagingSenderId:"146947124596",appId:"1:146947124596:web:87eba84ff229e14e37d021"},w=te().length?S():se(Ce),Me=K(w),Ve=ne(w),$e=Ue(w);export{Me as nrdAuth,Ve as nrdDb,$e as nrdStorage};
