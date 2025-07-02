// src/contexts/MessagingContext.tsx
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, orderBy, getDocs, getDoc, Timestamp, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useUser } from '../components/UserContext';
import './Messaging.css';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isOnline?: boolean;
  lastSeen?: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  content: string;
  timestamp: any;
  read: boolean;
}

interface Conversation {
  id: string;
  participants: string[];
  participantNames: { [key: string]: string };
  participantRoles: { [key: string]: string };
  lastMessage: string;
  lastMessageTime: any;
  unreadCount?: number;
}

interface MessagingContextType {
  isOpen: boolean;
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  users: User[];
  unreadTotal: number;
  
  openMessaging: () => void;
  closeMessaging: () => void;
  selectConversation: (conversationId: string) => void;
  selectUser: (userId: string) => void;
  sendMessage: (content: string) => Promise<void>;
  goBack: () => void;
}

const MessagingContext = createContext<MessagingContextType | undefined>(undefined);

export const useMessaging = () => {
  const context = useContext(MessagingContext);
  if (!context) {
    throw new Error('useMessaging must be used within MessagingProvider');
  }
  return context;
};

export const MessagingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const currentUser = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [showUserList, setShowUserList] = useState(false);
  const [isCurrentUserCustomer, setIsCurrentUserCustomer] = useState(false);
  const messagesListenerRef = useRef<(() => void) | null>(null);

  // Check if current user is a customer
  useEffect(() => {
    if (!currentUser?.uid) return;

    const checkIfCustomer = async () => {
      try {
        const customerDataQuery = query(
          collection(db, 'customer_data'),
          where('firebase_uid', '==', currentUser.uid)
        );
        const customerDataSnapshot = await getDocs(customerDataQuery);
        setIsCurrentUserCustomer(!customerDataSnapshot.empty);
      } catch (error) {
        console.error('Error checking customer status:', error);
      }
    };

    checkIfCustomer();
  }, [currentUser]);

  // Load available users
  useEffect(() => {
    if (!currentUser?.uid) return;

    const loadUsers = async () => {
      try {
        // Get all users from the users collection
        const usersQuery = query(collection(db, 'users'));
        const usersSnapshot = await getDocs(usersQuery);
        
        // Get all customer UIDs for filtering
        const allCustomerDataQuery = query(collection(db, 'customer_data'));
        const allCustomerDataSnapshot = await getDocs(allCustomerDataQuery);
        const customerUids = new Set(
          allCustomerDataSnapshot.docs
            .map(doc => doc.data().firebase_uid)
            .filter(Boolean)
        );

        const usersList = usersSnapshot.docs
          .filter(doc => doc.id !== currentUser.uid)
          .map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name || data.companyName || data.contactName || 'Unknown',
              email: data.email || '',
              role: data.role || 'unknown',
              isOnline: data.isOnline || false,
              lastSeen: data.lastSeen || ''
            };
          })
          .filter(user => {
            const isUserCustomer = customerUids.has(user.id);
            
            // If current user is a customer, only show brand managers
            if (isCurrentUserCustomer) {
              return user.role === 'brandManager';
            }
            
            // Otherwise, apply normal role-based filtering
            if (currentUser.role === 'brandManager' || currentUser.role === 'admin') {
              return true; // Can see everyone
            } else if (currentUser.role === 'salesAgent') {
              return user.role === 'brandManager' || isUserCustomer;
            }
            
            return false;
          })
          .sort((a, b) => {
            if (a.isOnline && !b.isOnline) return -1;
            if (!a.isOnline && b.isOnline) return 1;
            return a.name.localeCompare(b.name);
          });
        
        setUsers(usersList);
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };

    loadUsers();
  }, [currentUser, isCurrentUserCustomer]);

  // Load conversations
  useEffect(() => {
    if (!currentUser?.uid) return;

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const convList: Conversation[] = [];
      let totalUnread = 0;

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        
        // If current user is a customer, filter out conversations with other customers
        if (isCurrentUserCustomer) {
          const otherParticipantId = data.participants.find((p: string) => p !== currentUser.uid);
          if (otherParticipantId) {
            // Check if the other participant is a brand manager
            const otherUserDoc = await getDoc(doc(db, 'users', otherParticipantId));
            if (otherUserDoc.exists()) {
              const otherUserData = otherUserDoc.data();
              if (otherUserData.role !== 'brandManager' && otherUserData.role !== 'admin') {
                // Skip this conversation if the other user is not a brand manager or admin
                continue;
              }
            }
          }
        }
        
        const unreadQuery = query(
          collection(db, 'messages'),
          where('conversationId', '==', docSnap.id),
          where('recipientId', '==', currentUser.uid),
          where('read', '==', false)
        );
        const unreadSnap = await getDocs(unreadQuery);
        const unreadCount = unreadSnap.size;
        totalUnread += unreadCount;

        convList.push({
          id: docSnap.id,
          ...data,
          unreadCount
        } as Conversation);
      }

      setConversations(convList.sort((a, b) => {
        const timeA = a.lastMessageTime?.seconds || 0;
        const timeB = b.lastMessageTime?.seconds || 0;
        return timeB - timeA;
      }));
      setUnreadTotal(totalUnread);
    });

    return () => unsubscribe();
  }, [currentUser, isCurrentUserCustomer]);

  // Load messages for current conversation
  useEffect(() => {
    // Clear previous listener
    if (messagesListenerRef.current) {
      messagesListenerRef.current();
      messagesListenerRef.current = null;
    }

    if (!currentConversation?.id || !currentUser?.uid) {
      setMessages([]);
      return;
    }

    // Set up new listener
    const setupMessagesListener = async () => {
      try {
        // First, check if there are any messages
        const messagesRef = collection(db, 'messages');
        const q = query(
          messagesRef,
          where('conversationId', '==', currentConversation.id),
          orderBy('timestamp', 'asc')
        );

        const unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const msgList = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            } as Message));
            
            setMessages(msgList);

            // Mark unread messages as read
            msgList.forEach(async (msg) => {
              if (msg.recipientId === currentUser.uid && !msg.read) {
                await updateDoc(doc(db, 'messages', msg.id), { read: true });
              }
            });
          },
          (error) => {
            console.error('Error loading messages:', error);
            // If orderBy fails (no messages yet), set empty array
            setMessages([]);
          }
        );

        messagesListenerRef.current = unsubscribe;
      } catch (error) {
        console.error('Error setting up messages listener:', error);
        setMessages([]);
      }
    };

    setupMessagesListener();

    // Cleanup
    return () => {
      if (messagesListenerRef.current) {
        messagesListenerRef.current();
        messagesListenerRef.current = null;
      }
    };
  }, [currentConversation?.id, currentUser?.uid]);

  const openMessaging = () => {
    setIsOpen(true);
    setShowUserList(false);
    setCurrentConversation(null);
  };

  const closeMessaging = () => {
    setIsOpen(false);
    setShowUserList(false);
    setCurrentConversation(null);
    setMessages([]);
  };

  const selectConversation = (conversationId: string) => {
    const conv = conversations.find(c => c.id === conversationId);
    if (conv) {
      setCurrentConversation(conv);
      setShowUserList(false);
    }
  };

  const selectUser = async (userId: string) => {
    if (!currentUser) return;

    // Check if conversation exists
    const existingConv = conversations.find(
      conv => conv.participants.includes(userId) && conv.participants.includes(currentUser.uid!)
    );

    if (existingConv) {
      setCurrentConversation(existingConv);
      setShowUserList(false);
      return;
    }

    // Get user details
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.data();
    
    if (!userData) return;

    // Create new conversation
    const timestamp = Timestamp.now();
    const newConvData = {
      participants: [currentUser.uid, userId],
      participantNames: {
        [currentUser.uid!]: currentUser.name,
        [userId]: userData.name || userData.companyName || userData.contactName || 'Unknown'
      },
      participantRoles: {
        [currentUser.uid!]: currentUser.role || (isCurrentUserCustomer ? 'customer' : 'unknown'),
        [userId]: userData.role
      },
      lastMessage: '',
      lastMessageTime: timestamp,
      createdAt: timestamp
    };

    const newConvRef = await addDoc(collection(db, 'conversations'), newConvData);

    // Set as current conversation immediately
    const newConv: Conversation = {
      id: newConvRef.id,
      ...newConvData,
      unreadCount: 0
    };
    
    setCurrentConversation(newConv);
    setShowUserList(false);
  };

  const sendMessage = async (content: string) => {
    if (!currentUser || !currentConversation || !content.trim()) return;
    const recipientId = currentConversation.participants.find(p => p !== currentUser.uid);
    if (!recipientId) return;
    
    try {
      const timestamp = Timestamp.now();
      
      // Create the message object
      const messageData = {
        conversationId: currentConversation.id,
        senderId: currentUser.uid,
        senderName: currentUser.name,
        recipientId,
        recipientName: currentConversation.participantNames[recipientId],
        content: content.trim(),
        timestamp: timestamp,
        read: false
      };
      
      // Add message to Firestore (don't add to state - let listener handle it)
      await addDoc(collection(db, 'messages'), messageData);
      
      // Update conversation
      await updateDoc(doc(db, 'conversations', currentConversation.id), {
        lastMessage: content.trim(),
        lastMessageTime: timestamp
      });
      
      // Create notification
      await addDoc(collection(db, 'notifications'), {
        type: 'new_message',
        recipientId,
        title: 'New Message',
        message: `${currentUser.name} sent you a message`,
        createdAt: timestamp,
        read: false,
        data: {
          conversationId: currentConversation.id,
          senderId: currentUser.uid,
          senderName: currentUser.name
        }
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const goBack = () => {
    if (showUserList) {
      setShowUserList(false);
    } else if (currentConversation) {
      setCurrentConversation(null);
      setMessages([]);
    }
  };

  const value: MessagingContextType = {
    isOpen,
    conversations,
    currentConversation,
    messages,
    users,
    unreadTotal,
    openMessaging,
    closeMessaging,
    selectConversation,
    selectUser,
    sendMessage,
    goBack
  };

  return (
    <MessagingContext.Provider value={value}>
      {children}
      {isOpen && <MessagingUI showUserList={showUserList} setShowUserList={setShowUserList} />}
    </MessagingContext.Provider>
  );
};

// Internal UI Component
const MessagingUI: React.FC<{ showUserList: boolean; setShowUserList: (show: boolean) => void }> = ({ showUserList, setShowUserList }) => {
  const {
    currentConversation,
    conversations,
    messages,
    users,
    unreadTotal,
    closeMessaging,
    selectConversation,
    selectUser,
    sendMessage,
    goBack
  } = useMessaging();
  
  const currentUser = useUser();
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim()) {
      sendMessage(messageInput);
      setMessageInput('');
    }
  };

  const getOtherParticipant = (conv: Conversation) => {
    const otherId = conv.participants.find(id => id !== currentUser?.uid);
    return {
      id: otherId,
      name: conv.participantNames[otherId!] || 'Unknown',
      role: conv.participantRoles[otherId!] || 'unknown'
    };
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return 'now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="msg-popup">
      <div className="msg-header">
        {currentConversation ? (
          <>
            <button className="msg-back" onClick={goBack}>←</button>
            <div className="msg-header-info">
              <h3>{getOtherParticipant(currentConversation).name}</h3>
              <span>{getOtherParticipant(currentConversation).role}</span>
            </div>
          </>
        ) : showUserList ? (
          <>
            <button className="msg-back" onClick={goBack}>←</button>
            <h3>Select User</h3>
          </>
        ) : (
          <h3>Messages {unreadTotal > 0 && `(${unreadTotal})`}</h3>
        )}
        <button className="msg-close" onClick={closeMessaging}>×</button>
      </div>

      <div className="msg-content">
        {currentConversation ? (
          // Messages View
          <>
            <div className="msg-list">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`msg-item ${msg.senderId === currentUser?.uid ? 'sent' : 'received'}`}
                >
                  <div className="msg-bubble">
                    <p>{msg.content}</p>
                    <span className="msg-time">{formatTime(msg.timestamp)}</span>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSend} className="msg-form">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type a message..."
                className="msg-input"
                autoFocus
              />
              <button type="submit" className="msg-send" disabled={!messageInput.trim()}>
                →
              </button>
            </form>
          </>
        ) : showUserList ? (
          // User List
          <div className="msg-users">
            {users.map(user => (
              <div
                key={user.id}
                className="msg-user-item"
                onClick={() => selectUser(user.id)}
              >
                <div className="msg-avatar">{user.name.charAt(0).toUpperCase()}</div>
                <div className="msg-user-info">
                  <h4>{user.name}</h4>
                  <span>{user.role} {user.isOnline && '• Online'}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Conversation List
          <>
            <button className="msg-new" onClick={() => setShowUserList(true)}>
              + New Message
            </button>
            <div className="msg-convs">
              {conversations.length === 0 ? (
                <div className="msg-empty">
                  <p>No conversations yet</p>
                </div>
              ) : (
                conversations.map(conv => {
                  const other = getOtherParticipant(conv);
                  return (
                    <div
                      key={conv.id}
                      className={`msg-conv-item ${conv.unreadCount ? 'unread' : ''}`}
                      onClick={() => selectConversation(conv.id)}
                    >
                      <div className="msg-avatar">{other.name.charAt(0).toUpperCase()}</div>
                      <div className="msg-conv-info">
                        <h4>{other.name}</h4>
                        <p>{conv.lastMessage}</p>
                      </div>
                      {conv.unreadCount ? <span className="msg-badge">{conv.unreadCount}</span> : null}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};