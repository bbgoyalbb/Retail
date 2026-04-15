import { useState, useEffect, useCallback } from "react";
import { getJobwork } from "@/api";
import { PencilSimple } from "@phosphor-icons/react";
import api from "@/api";

function EditableField({ value, onSave, label, type = "text" }) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const handleBlur = () => { setIsEditing(false); if (tempValue !== value) onSave(tempValue); };
  
  if (isEditing) {
    return <input autoFocus type={type} className="border border-orange-500 rounded px-1 w-full text-sm outline-none" value={tempValue} onChange={(e) => setTempValue(e.target.value)} onBlur={handleBlur} onKeyDown={(e) => e.key === "Enter" && handleBlur()} />;
  }
  return (
    <div onDoubleClick={() => setIsEditing(true)} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded transition-all group">
      <span className="text-[10px] uppercase font-bold text-gray-400">{label}:</span>
      <span className="text-sm font-medium">{value || "---"}</span>
      <PencilSimple size={12} className="text-gray-300 opacity-0 group-hover:opacity-100" />
    </div>
  );
}

export default function JobWork() {
  const [tab, setTab] = useState("tailoring");
  const [data, setData] = useState({ pending: [], stitched: [], delivered: [], required: [], in_progress: [], finished: [] });

  const loadData = useCallback(async () => {
    try { const res = await getJobwork(tab); setData(res); } catch (err) { console.error("Database fetch failed"); }
  }, [tab]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleMove = async (id, targetStatus) => {
    try { await api.put(`/api/orders/${id}/update-work`, { status: targetStatus }); loadData(); } catch (err) { console.error("Move failed"); }
  };

  function StatusColumn({ title, items, color, moveLabel, prevStatus, nextStatus }) {
    return (
      <div className="flex flex-col h-full bg-gray-50 border border-gray-200 rounded overflow-hidden">
        <div className="p-3 border-b-2 font-bold text-xs uppercase tracking-widest text-gray-500" style={{ borderTop: `4px solid ${color}` }}>{title} ({items.length})</div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {items.map(item => (
            <div key={item.id} className="bg-white border border-gray-200 p-3 rounded shadow-sm space-y-2">
              <div className="flex justify-between text-[10px] font-bold"><span>#{item.order_no}</span><span className="text-gray-400 italic">{item.item_type}</span></div>
              <div className="text-sm font-semibold text-gray-800">{item.customer_name}</div>
              <div className="border-t border-gray-100 pt-2">
                <EditableField label="Karigar" value={item.karigar} onSave={(v) => api.put(`/api/orders/${item.id}/update-work`, { karigar: v }).then(loadData)} />
                <EditableField label="Amount" type="number" value={item.labour_amount} onSave={(v) => api.put(`/api/orders/${item.id}/update-work`, { labour_amount: v }).then(loadData)} />
              </div>
              <div className="flex gap-2 pt-2">
                {prevStatus && <button onClick={() => handleMove(item.id, prevStatus)} className="flex-1 py-1 text-[10px] font-bold border border-red-100 text-red-500 hover:bg-red-50">← BACK</button>}
                {nextStatus && <button onClick={() => handleMove(item.id, nextStatus)} className="flex-1 py-1 text-[10px] font-bold bg-orange-500 text-white hover:bg-orange-600 uppercase">{moveLabel} →</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex justify-between items-end border-b pb-4">
        <div><h1 className="text-2xl font-bold text-gray-800">Job Work Tracker</h1><p className="text-[10px] text-gray-400 uppercase tracking-widest">Narwana Agencies</p></div>
        <div className="flex gap-1 bg-gray-200 p-1 rounded">
          {["tailoring", "embroidery"].map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 text-xs font-bold uppercase rounded ${tab === t ? "bg-white shadow text-orange-600" : "text-gray-500"}`}>{t}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[75vh]">
        {tab === "tailoring" ? (
          <><StatusColumn title="Pending" items={data.pending} color="#F59E0B" moveLabel="Stitch" nextStatus="STITCHED" />
            <StatusColumn title="Stitched" items={data.stitched} color="#3B82F6" moveLabel="Deliver" nextStatus="DELIVERED" prevStatus="PENDING" />
            <StatusColumn title="Delivered" items={data.delivered} color="#10B981" prevStatus="STITCHED" /></>
        ) : (
          <><StatusColumn title="Required" items={data.required} color="#F59E0B" moveLabel="Start" nextStatus="IN_PROGRESS" />
            <StatusColumn title="In Progress" items={data.in_progress} color="#3B82F6" moveLabel="Finish" nextStatus="FINISHED" prevStatus="REQUIRED" />
            <StatusColumn title="Finished" items={data.finished} color="#10B981" prevStatus="IN_PROGRESS" /></>
        )}
      </div>
    </div>
  );
}