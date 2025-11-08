import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="bg-gray-800/50 shadow-lg backdrop-blur-md sticky top-0 z-10">
      <div className="container mx-auto px-4 py-4">
        <h1 className="text-2xl md:text-3xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
          Gemini AI: Tư duy & Giọng nói
        </h1>
        <p className="text-center text-sm text-gray-400 mt-1">
          Tương tác với AI tiên tiến cho các truy vấn phức tạp và lắng nghe phản hồi
        </p>
      </div>
    </header>
  );
};

export default Header;