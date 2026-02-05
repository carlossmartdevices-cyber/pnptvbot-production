import React from 'react';

export const Button = ({ children, onClick, className }) => {
  return (
    <button className={`hero-panel-btn ${className}`} onClick={onClick}>
      {children}
    </button>
  );
};
