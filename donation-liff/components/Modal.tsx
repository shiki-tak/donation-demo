import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
  isError?: boolean;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, message, isError = false }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full" id="my-modal">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className={`mt-3 text-center ${isError ? 'text-red-600' : 'text-green-600'}`}>
          <h3 className="text-lg leading-6 font-medium">{isError ? 'Error' : 'Success'}</h3>
          <div className="mt-2 px-7 py-3">
            <p className="text-sm text-gray-500">{message}</p>
          </div>
          <div className="items-center px-4 py-3">
            <button
              id="ok-btn"
              className={`px-4 py-2 ${isError ? 'bg-red-500' : 'bg-green-500'} text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-opacity-50`}
              onClick={onClose}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;
