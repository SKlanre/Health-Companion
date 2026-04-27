
import React, { useState, useEffect } from 'react';
import { UserCheck, UserX, Clock, Shield, Trash2, Users } from 'lucide-react';
import { Community, CommunityJoinRequest, CommunityMember } from '../types';
import { 
  db, 
  collection, 
  onSnapshot, 
  setDoc, 
  doc, 
  deleteDoc, 
  updateDoc, 
  serverTimestamp,
  increment,
  query,
  where,
  OperationType,
  handleFirestoreError
} from '../firebase';

interface Props {
  community: Community;
}

const CommunityAdmin: React.FC<Props> = ({ community }) => {
  const [requests, setRequests] = useState<CommunityJoinRequest[]>([]);
  const [members, setMembers] = useState<CommunityMember[]>([]);

  useEffect(() => {
    const qReq = query(collection(db, `communities/${community.id}/joinRequests`), where('status', '==', 'pending'));
    const unsubReq = onSnapshot(qReq, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CommunityJoinRequest)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `communities/${community.id}/joinRequests`);
    });

    const unsubMembers = onSnapshot(collection(db, `communities/${community.id}/members`), (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CommunityMember)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `communities/${community.id}/members`);
    });

    return () => {
      unsubReq();
      unsubMembers();
    };
  }, [community.id]);

  const handleApprove = async (request: CommunityJoinRequest) => {
    try {
      // 1. Add to members
      await setDoc(doc(db, `communities/${community.id}/members/${request.userId}`), {
        userId: request.userId,
        name: request.userName,
        role: 'member',
        joinedAt: serverTimestamp()
      });
      // 2. Mark request as accepted (or just delete)
      await updateDoc(doc(db, `communities/${community.id}/joinRequests/${request.userId}`), {
        status: 'accepted'
      });
      // 3. Increment member count
      await updateDoc(doc(db, 'communities', community.id), {
        membersCount: increment(1)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `communities/${community.id}/approve/${request.userId}`);
    }
  };

  const handleDecline = async (request: CommunityJoinRequest) => {
    try {
      await updateDoc(doc(db, `communities/${community.id}/joinRequests/${request.userId}`), {
        status: 'declined'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `communities/${community.id}/decline/${request.userId}`);
    }
  };

  const handleRemoveMember = async (member: CommunityMember) => {
    if (member.role === 'admin') return; // Cannot remove admin (self) easy way
    try {
      await deleteDoc(doc(db, `communities/${community.id}/members/${member.id}`));
      await updateDoc(doc(db, 'communities', community.id), {
        membersCount: increment(-1)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `communities/${community.id}/members/${member.id}`);
    }
  };

  return (
    <div className="space-y-8">
      {/* Join Requests */}
      <section>
        <div className="flex items-center gap-2 mb-4 px-1">
          <Clock className="w-4 h-4 text-amber-500" />
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending Requests ({requests.length})</h3>
        </div>
        {requests.length === 0 ? (
           <div className="p-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[32px] text-center opacity-50">
              <p className="text-[9px] font-black uppercase tracking-widest">No pending requests</p>
           </div>
        ) : (
          <div className="space-y-3">
            {requests.map(req => (
              <div key={req.id} className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black">
                      {req.userName[0]}
                   </div>
                   <p className="font-black text-slate-800 dark:text-slate-100">{req.userName}</p>
                </div>
                <div className="flex gap-2">
                   <button 
                     onClick={() => handleApprove(req)}
                     className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                   >
                     <UserCheck className="w-5 h-5" />
                   </button>
                   <button 
                     onClick={() => handleDecline(req)}
                     className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 rounded-2xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                   >
                     <UserX className="w-5 h-5" />
                   </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Members Management */}
      <section>
        <div className="flex items-center gap-2 mb-4 px-1">
          <Users className="w-4 h-4 text-indigo-500" />
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Manage Members ({members.length})</h3>
        </div>
        <div className="space-y-3">
          {members.map(member => (
            <div key={member.id} className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-50 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black">
                    {member.name[0]}
                 </div>
                 <div>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-100">{member.name}</p>
                    <span className="text-[8px] font-black uppercase text-indigo-500 tracking-tighter">{member.role}</span>
                 </div>
              </div>
              {member.role !== 'admin' && (
                <button 
                  onClick={() => handleRemoveMember(member)}
                  className="p-2 text-slate-300 dark:text-slate-700 hover:text-rose-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              {member.role === 'admin' && (
                 <Shield className="w-4 h-4 text-amber-500 mr-2" />
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default CommunityAdmin;
