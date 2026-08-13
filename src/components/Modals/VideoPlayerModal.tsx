'use client';

import React from 'react';
import { HubActivity } from '@/lib/supabaseClient';

interface VideoPlayerModalProps {
  activity: HubActivity | null;
  onClose: () => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ activity, onClose }) => {
  if (!activity) return null;

  let mp4Url = 'https://assets.mixkit.co/videos/preview/mixkit-students-walking-in-a-university-campus-41583-large.mp4';
  if (activity.type === 'Counselling Appointment' || activity.title.toLowerCase().includes('stress')) {
    mp4Url = 'https://assets.mixkit.co/videos/preview/mixkit-woman-meditating-by-the-sea-41584-large.mp4';
  } else if (activity.type === 'Summer Programme' || activity.type === 'Club Registration' || activity.title.toLowerCase().includes('stem')) {
    mp4Url = 'https://assets.mixkit.co/videos/preview/mixkit-science-laboratory-with-chemical-glassware-40242-large.mp4';
  }

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{activity.type}</h2>
          <button type="button" className="close-modal" onClick={onClose}>&times;</button>
        </div>
        <div className="video-modal-media">
          <video controls autoPlay muted style={{ width: '100%', height: '100%', borderRadius: 8 }}>
            <source src={mp4Url} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
        <div className="video-modal-info">
          <h4 className="video-modal-title">{activity.title}</h4>
          <p className="video-modal-desc">{activity.description}</p>
          {activity.video_url && (
            <div className="video-modal-actions">
              <a
                href={activity.video_url}
                target="_blank"
                rel="noreferrer"
                className="btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  textDecoration: 'none',
                  padding: '10px 20px',
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 8,
                }}
              >
                Watch on YouTube
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
