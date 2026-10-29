"use client";
import Image from 'next/image';
import {useState} from 'react';
import UserBadges from './user-badges';
export default function SlotCaller({name,avatar,large=false}:{name:string;avatar?:string;large?:boolean}){
 const [failed,setFailed]=useState('');
 return <span className={`inline-flex max-w-full items-center ${large ? "gap-3" : "gap-1.5"} align-middle`}><span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-purple-300/20 bg-purple-400/10 font-bold text-purple-200 ${large ? "h-14 w-14 sm:h-16 sm:w-16 text-lg" : "h-5 w-5 text-[9px]"}`}>{avatar&&failed!==avatar?<Image src={avatar} alt="" width={large ? 64 : 20} height={large ? 64 : 20} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" onError={()=>setFailed(avatar)}/>:name.slice(0,2).toUpperCase()}</span><span className="min-w-0 truncate">{name}</span><UserBadges name={name}/></span>;
}
