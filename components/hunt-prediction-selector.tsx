"use client";
import { useState } from 'react';
export default function HuntPredictionSelector({hunts,selectedId,activeId,onSelect}:{hunts:{localId?:string;title:string}[];selectedId:string;activeId:string;onSelect:(id:string)=>void}) {
  const [query,setQuery]=useState('');
  const visible=hunts.filter(h=>h.localId===selectedId||h.localId===activeId||h.title.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>Number(b.localId===activeId)-Number(a.localId===activeId));
  return <div className="hunt-history-controls">
    <label className="hunt-filter">Find a hunt<input type="search" placeholder="Search hunt names" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <label>Choose a bonus hunt<select aria-label="Choose bonus hunt from history" value={selectedId} onChange={e=>onSelect(e.target.value)}>
      <option value="" disabled>Choose a hunt</option>
      <optgroup label="Wheel and manual hunts">{visible.map(h=><option key={h.localId} value={h.localId}>{h.title}{h.localId===activeId?' · Active':''}</option>)}</optgroup>
    </select></label>
  </div>;
}
