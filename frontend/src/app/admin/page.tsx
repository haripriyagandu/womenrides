'use client';
import { useEffect, useState } from 'react';

type Driver = {
  _id: string;
  name: string;
  phone: string;
  status: string;
  createdAt: string;
};

export default function AdminDashboard() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      const res = await fetch('http://localhost:5001/api/admin/drivers');
      const data = await res.json();
      setDrivers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const verifyDriver = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:5001/api/admin/drivers/${id}/approve`, {
        method: 'PUT'
      });
      if (res.ok) {
        // Remove from UI optimistically or refresh
        setDrivers(drivers.filter(d => d._id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcf9f9] p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-[32px] font-black text-[#2b101c] tracking-tight mb-2">Admin Dashboard</h1>
        <p className="text-[#846b74] font-medium text-[16px] mb-8">Review and verify driver applications.</p>

        <div className="bg-white rounded-[24px] shadow-[0_8px_40px_rgba(235,215,220,0.6)] border border-[#faeef2] overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-[#846b74] font-bold">Loading applications...</div>
          ) : drivers.length === 0 ? (
             <div className="p-10 text-center flex flex-col items-center">
                 <div className="w-16 h-16 bg-[#f4faf6] rounded-full flex items-center justify-center text-[#4cb86c] mb-4">
                     <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                 </div>
                 <h3 className="text-[#2b101c] font-bold text-xl">All Caught Up!</h3>
                 <p className="text-[#846b74] font-medium">No pending driver applications to verify.</p>
             </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#fff9f9] border-b-2 border-[#faeef2]">
                  <th className="p-5 font-bold text-[#2b101c] text-[15px]">Driver Details</th>
                  <th className="p-5 font-bold text-[#2b101c] text-[15px]">Document</th>
                  <th className="p-5 font-bold text-[#2b101c] text-[15px]">Applied On</th>
                  <th className="p-5 font-bold text-[#2b101c] text-[15px] text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map(driver => (
                  <tr key={driver._id} className="border-b border-[#faeef2] hover:bg-[#fffcfc] transition-colors">
                    <td className="p-5">
                      <p className="font-bold text-[#2b101c] text-[16px] mb-0.5">{driver.name}</p>
                      <p className="text-[#846b74] text-[14px] font-medium">{driver.phone}</p>
                    </td>
                    <td className="p-5">
                      <div className="inline-flex items-center gap-2 bg-[#f4faf6] text-[#4cb86c] px-3 py-1.5 rounded-lg border border-[#a3d9b1] text-[13px] font-bold">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        ID Verified by AI
                      </div>
                    </td>
                    <td className="p-5 text-[#846b74] font-medium text-[14px]">
                       {new Date(driver.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-5 text-right">
                      <button onClick={() => verifyDriver(driver._id)} className="bg-gradient-to-r from-[#fc8aa5] to-[#fab282] hover:scale-105 active:scale-95 transition-transform text-white px-6 py-2.5 rounded-xl font-bold text-[14px] shadow-sm">
                        Verify & Approve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
