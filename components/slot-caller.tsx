"use client";
import Image from 'next/image';
import {useState} from 'react';
import UserBadges from './user-badges';
export default function SlotCaller({name,avatar}:{name:string;avatar?:string}){
 const [failed,setFailed]=useState('');
 return <span className="inline-flex max-w-full items-center gap-1.5 align-middle"><span aria-hidden="true" className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-purple-300/20 bg-purple-400/10 text-[9px] font-bold text-purple-200">{avatar&&failed!==avatar?<Image src={avatar} alt="" width={20} height={20} unoptimized referrerPolicy="no-referrer" onError={()=>setFailed(avatar)}/>:name.slice(0,2).toUpperCase()}</span><span className="min-w-0 truncate">{name}</span><UserBadges name={name}/></span>;
}
