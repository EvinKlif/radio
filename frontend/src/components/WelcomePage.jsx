import '../styles/WelcomePage.css';
import { useEffect } from 'react';

export default function WelcomePage({ onClose }) {

  return (
    <div className="welcome-page" onClick={onClose}>
      <div className="welcome-text">
        <div className="welcome-title">Welcome to</div>
        <div className="radio-title">RADIO</div>
      </div>
      
      <div className="a-star-container">
        <span className="letter letter-a">a</span>
        <span className="letter-s-wrapper">
          <span className="letter letter-s">S</span>
        </span>
        <span className="letter letter-t">t</span>
        <span className="letter letter-a">a</span>
        <span className="letter letter-r">r</span>
      </div>
    </div>
  );
}