import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: React.ReactNode;
  isError?: boolean;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, message, isError = false }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg max-w-md w-full">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">
            {isError ? 'Error' : 'Project Details'}
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4 text-gray-400" />
          </Button>
        </div>
        <div className="p-4 text-gray-300">
          {message}
        </div>
        <div className="p-4 border-t border-gray-700">
          <Button
            className="w-full"
            variant={isError ? "destructive" : "default"}
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
