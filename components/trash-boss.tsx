import { useId } from 'react';
import styles from './boss-battle-preview.module.css';
type Props = {
    hit: boolean;
    defeated: boolean;
    name?: string;
    variant?: number;
    miniature?: boolean;
};
export default function TrashBoss({ hit, defeated, name = 'Binzilla', variant = 2, miniature = false }: Props) {
    const id = useId().replace(/:/g, '');
    const palettes = [['#adb9d0', '#273148', '#a58bff'], ['#a6b951', '#253c22', '#b6ff57'], ['#b3bbce', '#252333', '#b7a0ff'], ['#a36261', '#301522', '#ff9855'], ['#d6b477', '#34284c', '#e1b2ff']];
    const [metal, dark, light] = palettes[variant] || palettes[2];
    const gradient = `url(#${id}-metal)`, glow = `url(#${id}-light)`;
    return <svg viewBox="0 0 480 390" className={miniature ? styles.portrait : `${styles.monster} ${styles[`variant${variant}`]} ${hit ? styles.hurt : ''} ${defeated ? styles.dead : ''}`} role={miniature ? undefined : 'img'} aria-hidden={miniature || undefined} aria-label={miniature ? undefined : defeated ? `${name} defeated` : name}>
 <defs><linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={metal}/><stop offset=".38" stopColor={dark}/><stop offset=".7" stopColor={metal}/><stop offset="1" stopColor={dark}/></linearGradient><radialGradient id={`${id}-light`}><stop stopColor="#fff6d9"/><stop offset=".35" stopColor={light}/><stop offset="1" stopColor={light} stopOpacity="0"/></radialGradient><filter id={`${id}-glow`}><feGaussianBlur stdDeviation="5"/></filter></defs>
 <ellipse cx="240" cy="358" rx="155" ry="17" fill="#03020a" opacity=".6"/><ellipse cx="240" cy="356" rx="117" ry="9" fill={light} opacity=".12"/>
 {variant === 0 && <>
  <g className={styles.armLeft}><path d="M152 212 Q100 174 75 222 L107 257 L144 244" fill={gradient} stroke={metal} strokeWidth="4"/><path d="M83 223 L56 201 L60 227 L38 214 L54 247 L101 262" fill={dark} stroke={metal} strokeWidth="3"/><path d="M59 204 L32 162 L12 180 L51 221" fill="#807a9b" stroke="#d7caef" strokeWidth="3"/></g>
  <g className={styles.armRight}><path d="M337 207 L373 182 L392 219 L369 259 L329 246" fill={gradient} stroke={metal} strokeWidth="4"/><path d="M391 220 L413 201 L439 228 L404 257 L370 247" fill={dark} stroke={metal} strokeWidth="3"/><circle cx="431" cy="204" r="16" fill="none" stroke="#c6a773" strokeWidth="6"/></g>
  <circle cx="173" cy="333" r="27" fill="#0c0b12" stroke="#8390a8" strokeWidth="8"/><circle cx="310" cy="333" r="27" fill="#0c0b12" stroke="#8390a8" strokeWidth="8"/>
  <path d="M147 139 L338 139 L322 322 Q240 341 164 322 Z" fill={gradient} stroke={metal} strokeWidth="5"/><path d="M160 132 L159 92 Q235 58 328 94 L321 139" fill="#21233d" stroke="#9d91c9" strokeWidth="5"/><path d="M138 124 L235 107 L351 121 L345 149 L140 151 Z" fill={gradient} stroke={metal} strokeWidth="4"/>
  <path d="M156 182 Q237 156 329 181 L321 229 Q240 204 164 231 Z" fill="#100e20" stroke="#756694" strokeWidth="3"/>
  <path d="M173 195 L219 184 L211 209 L176 213 Z M261 184 L310 195 L305 213 L270 209 Z" fill={light}/><path d="M189 192 L195 211 M290 191 L286 212" stroke="#fff" strokeWidth="5"/>
  <path d="M179 251 Q247 280 304 247 L286 292 Q230 313 196 284 Z" fill="#090612" stroke="#9580bd" strokeWidth="3"/><path d="M190 258 L203 276 L217 265 L233 280 L248 266 L265 277 L280 259" fill="#ecdebf"/>
  <path d="M182 153 L184 173 M309 155 L304 173 M173 301 L205 311 M282 312 L305 298" stroke="#d3bfed" strokeWidth="3" opacity=".45"/><path d="M225 90 L240 70 L256 92" fill="#a58bff"/><text x="240" y="322" fill="#d2bbff" fontSize="13" textAnchor="middle" letterSpacing="4">BANDIT</text>
 </>}
 {variant === 1 && <>
  <g className={styles.armLeft}><path d="M160 226 Q104 152 79 218 Q38 189 39 247 Q37 280 90 273 Q120 317 171 290" fill="#345126" stroke="#9cc25a" strokeWidth="4"/><circle cx="67" cy="244" r="13" fill="#bed767" opacity=".4"/></g>
  <g className={styles.armRight}><path d="M320 238 Q372 166 401 218 Q446 218 430 259 Q413 292 369 285 L317 308" fill="#345126" stroke="#9cc25a" strokeWidth="4"/></g>
  <path d="M139 156 Q133 85 238 85 Q347 90 344 165 L334 307 Q310 349 173 333 L146 290 Z" fill={gradient} stroke={metal} strokeWidth="5"/>
  <ellipse cx="242" cy="105" rx="92" ry="27" fill="#0d1d13" stroke="#adc469" strokeWidth="6"/><path d="M170 91 Q139 41 186 49 Q207 17 232 69 Q254 25 275 58 Q310 29 315 85 L321 129 Q291 110 287 151 Q267 169 260 123 Q247 113 239 150 Q220 159 210 124 Q190 115 192 147 Q173 157 168 119 Z" fill="#85b93e" stroke="#d1ef70" strokeWidth="3"/>
  <path d="M161 182 L322 173 M157 284 L335 278" stroke="#a9c569" strokeWidth="12"/><path d="M171 173 L174 293 M312 166 L309 296" stroke="#121f10" strokeWidth="4"/>
  {[190, 240, 290].map((x, i) => <g key={x}><circle cx={x} cy={207 + (i === 1 ? -15 : 0)} r="21" fill="#0e190f" stroke="#92bf43" strokeWidth="3"/><circle cx={x} cy={207 + (i === 1 ? -15 : 0)} r="12" fill="#e0ff6f"/><circle cx={x + 2} cy={207 + (i === 1 ? -15 : 0)} r="5" fill="#122210"/></g>)}
  <path d="M184 244 Q238 220 299 244 Q299 290 239 294 Q186 286 184 244" fill="#0a140c" stroke="#a9cc58" strokeWidth="3"/><path d="M193 245 L204 263 L219 240 L233 264 L250 240 L264 260 L287 244" fill="#d9e6a3"/>
  <path d="M146 319 Q121 340 156 349 L190 349 Q193 375 217 351 L242 351 Q268 378 283 351 L330 347 Q361 345 332 316" fill="#649635" stroke="#bfde5d" strokeWidth="3"/><circle cx="104" cy="100" r="12" fill={glow}/><circle cx="370" cy="63" r="23" fill={glow}/><circle cx="347" cy="148" r="11" fill="#c1ff49" opacity=".4"/>
 </>}
 {variant === 2 && <>
  <g className={styles.armLeft}><path d="M152 161 L109 163 L86 206 L110 224 L130 251 L158 237" fill={gradient} stroke={metal} strokeWidth="5"/><path d="M111 219 L76 230 L60 260 L89 295 L130 278 L146 245" fill="#2b273f" stroke="#a695bd" strokeWidth="5"/><path d="M67 258 L96 265 M83 244 L107 253" stroke={light} strokeWidth="4"/></g>
  <g className={styles.armRight}><path d="M324 162 L370 162 L395 206 L368 234 L340 249 L320 226" fill={gradient} stroke={metal} strokeWidth="5"/><path d="M370 220 L409 231 L426 263 L397 295 L351 277 L336 244" fill="#2b273f" stroke="#a695bd" strokeWidth="5"/><path d="M417 259 L389 265 M402 243 L379 253" stroke={light} strokeWidth="4"/></g>
  <path d="M169 286 L151 336 L132 344 L135 359 L211 359 L215 296 M274 297 L274 356 L348 357 L348 343 L329 334 L310 286" fill={gradient} stroke={metal} strokeWidth="5"/>
  <path d="M140 123 L179 91 L302 91 L346 125 L330 301 L277 331 L199 331 L151 300 Z" fill={gradient} stroke={metal} strokeWidth="6"/><path d="M137 146 L111 130 L113 108 L153 112 M344 146 L369 130 L367 108 L329 112" fill="#88849a" stroke="#dbd6e5" strokeWidth="4"/>
  <path d="M173 117 L186 55 L224 83 L242 40 L260 83 L300 54 L314 118" fill="#333041" stroke="#c9bfe0" strokeWidth="5"/>
  <path d="M177 142 Q240 123 309 142 L311 206 L283 229 L277 276 L209 276 L197 229 L173 204 Z" fill="#c1b7d3" stroke="#50445d" strokeWidth="5"/>
  <path d="M187 169 L220 160 L214 192 L185 196 Z M263 160 L299 169 L301 196 L270 192 Z" fill="#1a142a"/><path d="M192 175 L216 169 L210 184 L191 188 M269 169 L294 175 L295 188 L274 184" fill={light}/><path d="M240 198 L227 222 L250 223 Z" fill="#32273e"/>
  <path d="M214 249 L269 249 M224 231 L224 270 M242 230 L242 274 M260 231 L260 270" stroke="#3f314b" strokeWidth="5"/>
  <path d="M172 289 L200 306 L280 306 L310 285" fill="none" stroke={light} strokeWidth="4"/><circle cx="242" cy="298" r="7" fill="#eee0ff"/><path d="M158 174 L155 278 M328 174 L321 277" stroke="#7c6e93" strokeWidth="4"/>
 </>}
 {variant === 3 && <>
  <path d="M160 187 Q96 108 35 92 L65 166 L41 192 L93 212 L81 242 L155 239 M318 190 Q381 104 448 94 L418 167 L443 195 L388 213 L401 245 L324 241" fill="#361c36" stroke="#97515f" strokeWidth="5"/><path d="M51 112 L141 211 M435 113 L340 212" stroke="#f27554" strokeWidth="3" opacity=".6"/>
  <g className={styles.armLeft}><path d="M165 214 Q107 217 103 274 L62 306 L80 319 L107 302 L134 323 L146 288 L174 264" fill={gradient} stroke="#bd6f6b" strokeWidth="4"/><path d="M69 307 L60 334 L89 314 M134 320 L154 341 L146 304" fill="#ffbb76"/></g>
  <g className={styles.armRight}><path d="M318 218 Q371 214 377 274 L418 301 L403 320 L377 306 L351 326 L338 286 L311 258" fill={gradient} stroke="#bd6f6b" strokeWidth="4"/><path d="M411 305 L424 333 L395 314 M352 321 L332 343 L339 306" fill="#ffbb76"/></g>
  <path d="M151 151 Q120 101 142 36 Q156 80 198 98 M328 150 Q362 101 341 36 Q327 79 286 101" fill="#5e2c41" stroke="#d58982" strokeWidth="5"/>
  <path d="M157 137 L321 137 L343 281 L298 332 L182 334 L137 283 Z" fill={gradient} stroke="#c28582" strokeWidth="5"/><path d="M146 134 L192 100 L290 101 L337 132 L327 165 L154 167 Z" fill="#462334" stroke="#b27982" strokeWidth="5"/>
  <path d="M181 181 L222 196 L215 217 L182 207 Z M263 196 L300 181 L301 207 L270 217 Z" fill="#ffd595"/><path d="M191 187 L200 207 M290 187 L282 208" stroke="#ff7344" strokeWidth="6"/>
  <path d="M177 239 L216 250 L241 232 L265 251 L304 236 L286 284 L245 301 L198 282 Z" fill="#160b17" stroke="#dd9674" strokeWidth="3"/><path d="M190 242 L204 263 L215 249 M272 249 L282 265 L294 242" fill="#ffefc8"/>
  <path d="M211 315 Q182 295 208 267 Q209 295 238 274 Q219 242 250 218 Q243 260 270 275 Q299 307 270 327 Z" fill="#eb613d"/><path d="M230 317 Q214 303 240 280 Q238 300 253 289 Q269 309 254 326 Z" fill="#ffe08b"/><path d="M183 326 L163 354 L208 354 L219 335 M278 334 L291 356 L336 353 L308 324" fill="#4f2839" stroke="#ca7976" strokeWidth="4"/>
 </>}
 {variant === 4 && <>
  <path d="M158 147 L78 214 L123 312 L162 339 L175 255 M319 146 L401 210 L366 320 L319 345 L305 252" fill="#251633" stroke="#987091" strokeWidth="5"/><path d="M118 230 L100 250 L137 300 M364 231 L381 250 L348 301" stroke="#bea276" strokeWidth="7"/>
  <g className={styles.armLeft}><path d="M173 203 Q137 170 109 214 L70 203 L46 221 L79 243 L113 241 Q128 277 169 263" fill={gradient} stroke="#c3a687" strokeWidth="4"/><path d="M56 221 L42 180 L27 182 L35 320 L64 320 L56 245" fill="#a68957" stroke="#efdca0" strokeWidth="4"/><circle cx="35" cy="164" r="25" fill="#423156" stroke="#d9bd85" strokeWidth="5"/><path d="M25 157 L35 138 L47 157 L36 178 Z" fill="#dcadff"/></g>
  <g className={styles.armRight}><path d="M309 205 Q347 176 373 212 L411 189 L430 203 L410 238 L376 246 Q352 277 313 267" fill={gradient} stroke="#c3a687" strokeWidth="4"/><circle cx="409" cy="174" r="24" fill={glow}/><path d="M397 161 L409 144 L423 169 L414 189 L398 183 Z" fill="#cf98f4" stroke="#eed2ff" strokeWidth="2"/></g>
  <path d="M165 128 L320 126 L327 280 L292 331 L193 332 L153 282 Z" fill={gradient} stroke="#b5a093" strokeWidth="6"/><path d="M169 208 L197 190 L243 213 L287 188 L318 209 L310 286 L282 323 L204 324 L166 282 Z" fill="#302038" stroke="#b79477" strokeWidth="4"/>
  <path d="M179 128 L161 52 L207 80 L242 26 L276 80 L324 52 L307 130 Z" fill="#b9924f" stroke="#ffdda0" strokeWidth="5"/><path d="M185 107 L298 107 L298 128 L184 128 Z" fill="#6e4c35"/><path d="M225 89 L242 62 L259 90 L241 113 Z" fill="#d7acff" stroke="#f8deff" strokeWidth="3"/><circle cx="185" cy="81" r="6" fill="#e3c1ff"/><circle cx="297" cy="81" r="6" fill="#e3c1ff"/>
  <path d="M180 151 Q242 131 306 151 L301 196 L280 211 L275 244 L208 244 L204 211 L182 197 Z" fill="#d5c4af" stroke="#8f6d80" strokeWidth="4"/><path d="M195 174 L222 166 L217 193 L193 191 M263 165 L291 172 L291 191 L270 194" fill="#683b82"/><path d="M200 175 L217 173 M272 173 L285 176" stroke="#ffe3ff" strokeWidth="5"/><path d="M241 196 L230 213 L249 213 M217 231 L269 231 M229 218 L229 242 M247 218 L247 243 M262 218 L262 241" stroke="#64475c" strokeWidth="4"/>
  <path d="M208 265 L242 247 L277 265 L265 302 L244 321 L220 302 Z" fill="#b79259" stroke="#f1d6a0" strokeWidth="4"/><path d="M230 268 L241 257 L257 269 L246 294 L236 294 Z" fill="#d9b0ff"/>
  <path d="M171 312 Q121 323 150 347 L203 343 Q220 371 245 341 Q270 369 291 343 L345 349 Q365 326 316 313" fill="#211729" stroke="#947983" strokeWidth="4"/><path d="M178 327 L166 342 M217 329 L212 347 M272 328 L279 345 M308 328 L321 344" stroke="#c1a465" strokeWidth="3"/>
 </>}
 </svg>;
}
