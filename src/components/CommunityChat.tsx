
import React, { useState, useEffect, useRef } from 'react';
import { Send, Smile } from 'lucide-react';
import { Community, CommunityMessage } from '../types';
import { 
  db, 
  auth, 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  limit,
  OperationType,
  handleFirestoreError
} from '../firebase';

interface Props {
  community: Community;
}

const CommunityChat: React.FC<Props> = ({ community }) => {
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, `communities/${community.id}/messages`),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CommunityMessage));
      setMessages(msgs);
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `communities/${community.id}/messages`);
    });

    return unsubscribe;
  }, [community.id]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !auth.currentUser) return;

    try {
      await addDoc(collection(db, `communities/${community.id}/messages`), {
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.displayName || 'Anonymous',
        text: text.trim(),
        timestamp: serverTimestamp()
      });
      setText('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `communities/${community.id}/messages`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="flex-1 overflow-y-auto space-y-4 pb-20 no-scrollbar">
        {messages.map((msg) => {
          const isMine = msg.senderId === auth.currentUser?.uid;
          return (
            <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
              <div className="flex items-end gap-2 max-w-[85%]">
                {!isMine && (
                   <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black shrink-0">
                      {msg.senderName[0]}
                   </div>
                )}
                <div className={`p-4 rounded-[24px] ${
                  isMine 
                  ? 'bg-indigo-600 text-white rounded-br-none' 
                  : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-800 rounded-bl-none'
                }`}>
                  {!isMine && <p className="text-[9px] font-black uppercase opacity-50 mb-1">{msg.senderName}</p>}
                  <p className="text-sm font-medium">{msg.text}</p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      <div className="absolute bottom-4 left-4 right-4 h-16 bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-xl flex items-center px-2">
        <button className="p-3 text-slate-400 hover:text-indigo-600 transition-colors">
          <Smile className="w-6 h-6" />
        </button>
        <form onSubmit={handleSend} className="flex-1 flex gap-2">
          <input 
            type="text"
            placeholder="Type a message..."
            className="flex-1 bg-transparent border-none focus:ring-0 font-bold text-slate-800 dark:text-white"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button 
            type="submit"
            className="p-3 bg-indigo-600 text-white rounded-full active:scale-95 transition-all shadow-md shadow-indigo-100 dark:shadow-indigo-900/20"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default CommunityChat;
