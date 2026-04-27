
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  MessageCircle, 
  Send, 
  Image as ImageIcon, 
  MoreHorizontal, 
  Share2,
  Trash2,
  Smile
} from 'lucide-react';
import { FeedPost, UserProfile } from '../types';
import { 
  db, 
  auth, 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  updateDoc,
  doc,
  increment,
  deleteDoc,
  OperationType,
  handleFirestoreError
} from '../firebase';

interface Props {
  userProfile: UserProfile | null;
}

const GeneralFeed: React.FC<Props> = ({ userProfile }) => {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [newPost, setNewPost] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'feed'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FeedPost)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'feed');
    });
    return unsubscribe;
  }, []);

  const handlePost = async () => {
    if (!newPost.trim() || !auth.currentUser || !userProfile) return;
    setIsPosting(true);
    try {
      await addDoc(collection(db, 'feed'), {
        authorId: auth.currentUser.uid,
        authorName: userProfile.name,
        content: newPost.trim(),
        timestamp: serverTimestamp(),
        likes: 0,
        comments: 0
      });
      setNewPost('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'feed');
    } finally {
      setIsPosting(false);
    }
  };

  const handleLike = async (postId: string) => {
    try {
      await updateDoc(doc(db, 'feed', postId), {
        likes: increment(1)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `feed/${postId}`);
    }
  };

  const handleDelete = async (postId: string) => {
    try {
      await deleteDoc(doc(db, 'feed', postId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `feed/${postId}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Post */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500 flex items-center justify-center text-white font-black shrink-0">
             {userProfile?.name.charAt(0) || 'U'}
          </div>
          <textarea 
            placeholder="Share your progress or ask a question..."
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            className="flex-1 bg-transparent border-none focus:ring-0 font-medium text-slate-800 dark:text-white resize-none min-h-[80px] py-1 no-scrollbar text-sm"
          />
        </div>
        <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800">
           <div className="flex items-center gap-4">
              <button className="flex items-center gap-1 text-slate-400 hover:text-indigo-600 transition-colors">
                 <ImageIcon className="w-5 h-5" />
                 <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Image</span>
              </button>
              <button className="flex items-center gap-1 text-slate-400 hover:text-amber-600 transition-colors">
                 <Smile className="w-5 h-5" />
                 <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Feeling</span>
              </button>
           </div>
           <button 
             onClick={handlePost}
             disabled={!newPost.trim() || isPosting}
             className="px-6 py-2 bg-indigo-600 text-white font-black rounded-xl shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
           >
             <Send className="w-4 h-4" />
             <span className="text-xs uppercase tracking-widest">Post</span>
           </button>
        </div>
      </div>

      {/* Feed */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {posts.map((post) => (
            <motion.div 
              key={post.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm"
            >
              <div className="flex justify-between items-start mb-4">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-900 dark:text-white uppercase">
                       {post.authorName.charAt(0)}
                    </div>
                    <div>
                       <h4 className="font-black text-slate-900 dark:text-white uppercase text-sm leading-tight">{post.authorName}</h4>
                       <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Community Member</span>
                    </div>
                 </div>
                 {post.authorId === auth.currentUser?.uid && (
                   <button 
                     onClick={() => handleDelete(post.id)}
                     className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                   >
                     <Trash2 className="w-4 h-4" />
                   </button>
                 )}
              </div>

              <p className="text-slate-700 dark:text-slate-300 font-medium text-sm leading-relaxed mb-6 whitespace-pre-wrap">
                {post.content}
              </p>

              {post.image && (
                <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-2xl mb-6 overflow-hidden border border-slate-50 dark:border-slate-800">
                   <img src={post.image} alt="Post content" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="flex items-center gap-6 pt-4 border-t border-slate-50 dark:border-slate-800">
                 <button 
                   onClick={() => handleLike(post.id)}
                   className="flex items-center gap-2 group"
                 >
                    <div className="p-2 bg-rose-50 dark:bg-rose-950/30 rounded-xl group-hover:bg-rose-500 group-hover:text-white transition-all">
                       <Heart className="w-4 h-4 text-rose-500 group-hover:text-white" />
                    </div>
                    <span className="text-xs font-black text-slate-500 dark:text-slate-400">{post.likes}</span>
                 </button>

                 <button className="flex items-center gap-2 group cursor-not-allowed opacity-50">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl">
                       <MessageCircle className="w-4 h-4 text-indigo-500" />
                    </div>
                    <span className="text-xs font-black text-slate-500 dark:text-slate-400">{post.comments}</span>
                 </button>

                 <div className="flex-1" />

                 <button className="p-2 text-slate-300 hover:text-indigo-600 transition-colors">
                    <Share2 className="w-5 h-5" />
                 </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {posts.length === 0 && (
          <div className="py-20 text-center space-y-4 opacity-30">
             <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full mx-auto flex items-center justify-center">
                <ImageIcon className="w-8 h-8" />
             </div>
             <p className="text-xs font-black uppercase tracking-widest text-slate-500">No feed activity yet. Be the first to post!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GeneralFeed;
