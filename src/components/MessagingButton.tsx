import React from 'react';
import { FaComments } from 'react-icons/fa';
import { useMessaging } from '../contexts/MessagingContext';
import './MessagingButton.css';

export default function MessagingButton() {
  const { openMessaging, unreadTotal } = useMessaging();
  
  return (
    <button className="msg-float-btn" onClick={openMessaging}>
      <FaComments />
      {unreadTotal > 0 && <span className="msg-float-badge">{unreadTotal}</span>}
    </button>
  );
}