
import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Lock, 
  Globe, 
  ChevronRight, 
  Trophy, 
  BookOpen, 
  MessageSquare, 
  Video,
  Shield,
  ArrowLeft,
  X,
  Send,
  Play,
  UserPlus,
  Clock,
  Settings,
  Check,
  Trash2,
  Image as ImageIcon
} from 'lucide-react';
import { 
  Community, 
  CommunityType, 
  CommunityMessage, 
  CommunityMember, 
  CommunityJoinRequest, 
  CommunityVideo,
  UserProfile
} from '../types';
import { 
  db, 
  auth, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  setDoc, 
  doc, 
  serverTimestamp, 
  orderBy, 
  updateDoc, 
  deleteDoc,
  getDocs,
  limit,
  increment,
  OperationType,
  handleFirestoreError
} from '../firebase';

// Sub-components
import CommunityChat from '../components/CommunityChat';
import CommunityVideos from '../components/CommunityVideos';
import CommunityAdmin from '../components/CommunityAdmin';
import GeneralFeed from '../components/GeneralFeed';

interface Props {
  userProfile: UserProfile | null;
}

const CommunityPage: React.FC<Props> = ({ userProfile }) => {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'group' | 'all' | 'feed'>('feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMember, setIsMember] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);

  const [rawCommunities, setRawCommunities] = useState<Community[]>([]);
  const filteredCommunities = rawCommunities.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const q = activeTab === 'all' 
      ? query(collection(db, 'communities'), orderBy('createdAt', 'desc'))
      : activeTab === 'feed'
        ? query(collection(db, 'communities'), orderBy('createdAt', 'desc')) // Placeholder for feed logic if needed, but feed tab uses GeneralFeed component
        : query(collection(db, 'communities'), where('type', '==', activeTab), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const comms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Community));
      setRawCommunities(comms);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'communities');
    });

    return unsubscribe;
  }, [activeTab]);

  useEffect(() => {
    if (selectedCommunity && auth.currentUser) {
      setIsMember(false);
      setHasPendingRequest(false);
      
      const memberRef = doc(db, `communities/${selectedCommunity.id}/members/${auth.currentUser.uid}`);
      const requestRef = doc(db, `communities/${selectedCommunity.id}/joinRequests/${auth.currentUser.uid}`);

      const unsubMember = onSnapshot(memberRef, (doc) => setIsMember(doc.exists()), (error) => {
        handleFirestoreError(error, OperationType.GET, `communities/${selectedCommunity.id}/members/${auth.currentUser?.uid}`);
      });
      const unsubRequest = onSnapshot(requestRef, (doc) => setHasPendingRequest(doc.exists() && doc.data()?.status === 'pending'), (error) => {
        handleFirestoreError(error, OperationType.GET, `communities/${selectedCommunity.id}/joinRequests/${auth.currentUser?.uid}`);
      });

      return () => {
        unsubMember();
        unsubRequest();
      };
    }
  }, [selectedCommunity]);

  const handleCreateCommunity = async (data: Partial<Community>) => {
    if (!auth.currentUser || !userProfile) return;
    
    try {
      const commData = {
        ...data,
        creatorId: auth.currentUser.uid,
        creatorName: userProfile.name,
        membersCount: 1,
        createdAt: new Date().toISOString(),
      };
      
      const docRef = await addDoc(collection(db, 'communities'), commData);
      
      // Add creator as admin member
      await setDoc(doc(db, `communities/${docRef.id}/members/${auth.currentUser.uid}`), {
        userId: auth.currentUser.uid,
        name: userProfile.name,
        role: 'admin',
        joinedAt: serverTimestamp()
      });

      setShowCreateModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'communities');
    }
  };

  const handleJoin = async (community: Community) => {
    if (!auth.currentUser || !userProfile) return;

    try {
      if (community.isPrivate) {
        await setDoc(doc(db, `communities/${community.id}/joinRequests/${auth.currentUser.uid}`), {
          userId: auth.currentUser.uid,
          userName: userProfile.name,
          status: 'pending',
          timestamp: serverTimestamp()
        });
      } else {
        await setDoc(doc(db, `communities/${community.id}/members/${auth.currentUser.uid}`), {
          userId: auth.currentUser.uid,
          name: userProfile.name,
          role: 'member',
          joinedAt: serverTimestamp()
        });
        await updateDoc(doc(db, 'communities', community.id), {
          membersCount: increment(1)
        });
      }
    } catch (error) {
       handleFirestoreError(error, OperationType.WRITE, `communities/${community.id}/joinOrRequest`);
    }
  };

  if (selectedCommunity) {
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 -m-6 p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-4 pt-10 flex items-center gap-4">
          <button 
            onClick={() => setSelectedCommunity(null)}
            className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
          </button>
          <div className="flex-1">
            <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">{selectedCommunity.name}</h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{selectedCommunity.type}</span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{selectedCommunity.membersCount} members</span>
            </div>
          </div>
          {selectedCommunity.creatorId === auth.currentUser?.uid && (
             <div className="bg-amber-50 dark:bg-amber-950/30 p-2 rounded-xl">
                <Shield className="w-5 h-5 text-amber-600" />
             </div>
          )}
        </div>

        {/* Content */}
        {!isMember ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-6">
            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-950/30 rounded-3xl flex items-center justify-center text-indigo-600 mb-2">
               {selectedCommunity.isPrivate ? <Lock className="w-10 h-10" /> : <Globe className="w-10 h-10" />}
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
                {selectedCommunity.isPrivate ? 'Private Group' : 'Join the Group'}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                {selectedCommunity.description}
              </p>
            </div>
            
            {hasPendingRequest ? (
               <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 p-4 rounded-2xl flex items-center gap-3">
                  <Clock className="w-5 h-5 text-amber-600" />
                  <span className="text-amber-800 dark:text-amber-300 font-bold text-sm">Join request is pending creator approval</span>
               </div>
            ) : (
              <button 
                onClick={() => handleJoin(selectedCommunity)}
                className="w-full max-w-xs py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 dark:shadow-indigo-900/20 hover:scale-[1.02] active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                <UserPlus className="w-5 h-5" />
                {selectedCommunity.isPrivate ? 'Request to Join' : 'Join Group'}
              </button>
            )}
          </div>
        ) : (
          <CommunityView 
            community={selectedCommunity} 
            isCreator={selectedCommunity.creatorId === auth.currentUser?.uid} 
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white mt-4 leading-tight">Explore & Join</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 font-medium italic">Level up with others</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100 dark:shadow-indigo-900/30 hover:scale-110 transition-transform active:scale-95"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
        {['feed', 'all', 'group'].map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t as any)}
            className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
              activeTab === t 
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md' 
              : 'bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-800'
            }`}
          >
            {t === 'all' ? 'All Groups' : t === 'feed' ? 'Post Feed' : t + 's'}
          </button>
        ))}
      </div>

      {activeTab === 'feed' ? (
        <GeneralFeed userProfile={userProfile} />
      ) : (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
            <input 
              type="text"
              placeholder="Search groups..."
              className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl font-bold text-slate-800 dark:text-white focus:border-indigo-500 focus:outline-none transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCommunities.map((comm) => (
              <button
                key={comm.id}
                onClick={() => setSelectedCommunity(comm)}
                className="flex flex-col text-left bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-sm border border-slate-100 dark:border-slate-800 hover:border-indigo-100 dark:hover:border-indigo-900 transition-all group active:scale-[0.98]"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-500">
                    <Users className="w-6 h-6" />
                  </div>
                  <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-full">
                    {comm.isPrivate ? <Lock className="w-3 h-3 text-slate-400" /> : <Globe className="w-3 h-3 text-indigo-400" />}
                    <span className="text-[9px] font-black uppercase text-slate-400">{comm.isPrivate ? 'Private' : 'Public'}</span>
                  </div>
                </div>
                
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 group-hover:text-indigo-600 transition-colors uppercase">{comm.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-6 line-clamp-2 leading-relaxed">
                  {comm.description}
                </p>
                
                <div className="mt-auto pt-4 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                       {[1,2,3].map(i => (
                          <div key={i} className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[8px] font-black text-slate-400">
                            {i}
                          </div>
                       ))}
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{comm.membersCount}+ joined</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {showCreateModal && (
        <CreateCommunityModal 
          onClose={() => setShowCreateModal(false)} 
          onSubmit={handleCreateCommunity} 
          userProfile={userProfile}
        />
      )}
    </div>
  );
};

const CreateCommunityModal: React.FC<{ onClose: () => void, onSubmit: (data: Partial<Community>) => void, userProfile: UserProfile | null }> = ({ onClose, onSubmit, userProfile }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [type, setType] = useState<CommunityType>('group');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-6 animate-in fade-in zoom-in duration-200">
      <div className="bg-white dark:bg-slate-950 w-full max-w-sm rounded-[40px] p-8 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors">
          <X className="w-5 h-5 text-slate-400" />
        </button>

        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Create Group</h3>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-8 text-center italic">Start something awesome</p>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Name</label>
            <input 
              type="text" 
              placeholder="e.g. Morning Joggers"
              className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl font-bold text-slate-800 dark:text-white focus:border-indigo-500 focus:outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
            <textarea 
              placeholder="What is this group about?"
              className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl font-bold text-slate-800 dark:text-white focus:border-indigo-500 focus:outline-none h-24 no-scrollbar resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="hidden">
            {(['challenge', 'group'] as CommunityType[]).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                  type === t ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-900 text-slate-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Lock className={`w-4 h-4 ${isPrivate ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tighter">Private Community</span>
            </div>
            <button 
              onClick={() => setIsPrivate(!isPrivate)}
              className={`w-10 h-5 rounded-full relative transition-colors ${isPrivate ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-800'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${isPrivate ? 'right-0.5' : 'left-0.5'}`} />
            </button>
          </div>

          <button 
            onClick={() => onSubmit({ name, description, isPrivate, type })}
            disabled={!name || !description}
            className="w-full py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-black rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
          >
            Launch Group
          </button>
        </div>
      </div>
    </div>
  );
};

const CommunityView: React.FC<{ community: Community, isCreator: boolean }> = ({ community, isCreator }) => {
  const [viewTab, setViewTab] = useState<'chat' | 'videos' | 'admin'>('chat');

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Sub Tabs */}
      <div className="flex bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <button 
          onClick={() => setViewTab('chat')}
          className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all relative ${
            viewTab === 'chat' ? 'text-indigo-600' : 'text-slate-400'
          }`}
        >
          Chat Room
          {viewTab === 'chat' && <div className="absolute bottom-0 left-1/4 right-1/4 h-1 bg-indigo-600 rounded-t-full" />}
        </button>
        <button 
          onClick={() => setViewTab('videos')}
          className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all relative ${
            viewTab === 'videos' ? 'text-indigo-600' : 'text-slate-400'
          }`}
        >
          Videos & Info
          {viewTab === 'videos' && <div className="absolute bottom-0 left-1/4 right-1/4 h-1 bg-indigo-600 rounded-t-full" />}
        </button>
        {isCreator && (
          <button 
            onClick={() => setViewTab('admin')}
            className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all relative ${
              viewTab === 'admin' ? 'text-amber-600' : 'text-slate-400'
            }`}
          >
            Admin Panel
            {viewTab === 'admin' && <div className="absolute bottom-0 left-1/4 right-1/4 h-1 bg-amber-600 rounded-t-full" />}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar relative p-4">
        {viewTab === 'chat' && <CommunityChat community={community} />}
        {viewTab === 'videos' && <CommunityVideos community={community} isCreator={isCreator} />}
        {viewTab === 'admin' && isCreator && <CommunityAdmin community={community} />}
      </div>
    </div>
  );
};

export default CommunityPage;
