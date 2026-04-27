
import React, { useState, useEffect } from 'react';
import { Play, Plus, X, Video, Heart, Share2, Info } from 'lucide-react';
import { Community, CommunityVideo } from '../types';
import { 
  db, 
  auth, 
  collection, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  orderBy,
  query,
  OperationType,
  handleFirestoreError
} from '../firebase';

interface Props {
  community: Community;
  isCreator: boolean;
}

const CommunityVideos: React.FC<Props> = ({ community, isCreator }) => {
  const [videos, setVideos] = useState<CommunityVideo[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, `communities/${community.id}/videos`),
      orderBy('timestamp', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      setVideos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CommunityVideo)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `communities/${community.id}/videos`);
    });
  }, [community.id]);

  const handleAddVideo = async () => {
    if (!newTitle.trim() || !newUrl.trim() || !auth.currentUser) return;
    try {
      await addDoc(collection(db, `communities/${community.id}/videos`), {
        title: newTitle.trim(),
        videoUrl: newUrl.trim(),
        uploaderId: auth.currentUser.uid,
        uploaderName: auth.currentUser.displayName || 'Creator',
        timestamp: serverTimestamp()
      });
      setShowAddModal(false);
      setNewTitle('');
      setNewUrl('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `communities/${community.id}/videos`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Community Info Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 mb-4 text-indigo-600 dark:text-indigo-400">
           <Info className="w-4 h-4" />
           <span className="text-[10px] font-black uppercase tracking-widest">About this {community.type}</span>
        </div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed italic">
          "{community.description}"
        </p>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Video Library</h3>
        {isCreator && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all"
          >
            <Plus className="w-3 h-3" /> Add Content
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {videos.length === 0 ? (
           <div className="py-12 text-center flex flex-col items-center gap-4 opacity-30">
              <Video className="w-12 h-12" />
              <p className="text-xs font-black uppercase tracking-widest">No videos uploaded yet</p>
           </div>
        ) : (
          videos.map((video) => (
            <div key={video.id} className="bg-white dark:bg-slate-900 rounded-[32px] overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm group">
              <div className="aspect-video bg-slate-100 dark:bg-slate-800 relative flex items-center justify-center">
                 <Video className="w-12 h-12 text-slate-300 dark:text-slate-700" />
                 <a 
                   href={video.videoUrl} 
                   target="_blank" 
                   rel="noreferrer"
                   className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-all"
                 >
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-2xl scale-90 group-hover:scale-100 transition-transform">
                       <Play className="w-8 h-8 text-indigo-600 fill-indigo-600 translate-x-0.5" />
                    </div>
                 </a>
              </div>
              <div className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-black text-lg text-slate-900 dark:text-white uppercase leading-tight">{video.title}</h4>
                  <div className="flex gap-4">
                     <Heart className="w-5 h-5 text-slate-300 dark:text-slate-700 hover:text-rose-500 transition-colors cursor-pointer" />
                     <Share2 className="w-5 h-5 text-slate-300 dark:text-slate-700 hover:text-blue-500 transition-colors cursor-pointer" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[8px] font-black">
                      {video.uploaderName[0]}
                   </div>
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{video.uploaderName} • Video Lesson</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[250] flex items-center justify-center p-6 animate-in fade-in zoom-in duration-200">
          <div className="bg-white dark:bg-slate-950 w-full max-w-sm rounded-[40px] p-8 shadow-2xl relative">
            <button onClick={() => setShowAddModal(false)} className="absolute top-6 right-6 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-6 uppercase">Upload Video</h3>
            
            <div className="space-y-6">
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Title</label>
                  <input 
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Lesson title..."
                    className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl font-bold text-slate-800 dark:text-white focus:border-indigo-500 focus:outline-none"
                  />
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Video URL (link)</label>
                  <input 
                    type="text"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="YouTube, Vimeo or direct link..."
                    className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl font-bold text-slate-800 dark:text-white focus:border-indigo-500 focus:outline-none"
                  />
               </div>
               <button 
                 onClick={handleAddVideo}
                 className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:scale-105 transition-all"
               >
                 Add to Library
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityVideos;
