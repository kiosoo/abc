
import React, { useEffect } from 'react';
// FIX: Add file extensions to imports to resolve module loading errors.
import { Notification as NotificationType } from '@/types.ts';
import { SuccessIcon, ErrorIcon, InfoIcon } from '@/components/Icons.tsx';

interface NotificationProps {
  notification: NotificationType;
  onDismiss: (id: number) => void;
}

const icons = {
  success: <SuccessIcon className="h-6 w-6 text-green-400" />,
  error: <ErrorIcon className="h-6 w-6 text-red-400" />,
  info: <InfoIcon className="h-6 w-6 text-blue-400" />,
};

const colors = {
  success: 'bg-green-800/80 border-green-600',
  error: 'bg-red-800/80 border-red-600',
  info: 'bg-blue-800/80 border-blue-600',
};

const Notification: React.FC<NotificationProps> = ({ notification, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(notification.id);
    }, 5000); // Auto-dismiss after 5 seconds

    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  return (
    <div
      className={`flex items-center p-4 mb-4 text-sm text-white rounded-lg shadow-lg backdrop-blur-md border ${colors[notification.type]}`}
      role="alert"
    >
      <div className="flex-shrink-0 mr-3">
        {icons[notification.type]}
        <span className="sr-only">{notification.type} icon</span>
      </div>
      <div className="flex-grow">{notification.message}</div>
      <button
        type="button"
        className="ml-4 -mx-1.5 -my-1.5 bg-transparent text-gray-300 hover:text-white rounded-lg focus:ring-2 focus:ring-gray-400 p-1.5 inline-flex h-8 w-8"
        onClick={() => onDismiss(notification.id)}
        aria-label="Close"
      >
        <span className="sr-only">Close</span>
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          ></path>
        </svg>
      </button>
    </div>
  );
};

interface NotificationContainerProps {
  notifications: NotificationType[];
  onDismiss: (id: number) => void;
}

export const NotificationContainer: React.FC<NotificationContainerProps> = ({ notifications, onDismiss }) => {
  return (
    <div className="fixed top-5 right-5 z-50 w-full max-w-sm">
      {notifications.map((notification) => (
        <Notification key={notification.id} notification={notification} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

export default Notification;