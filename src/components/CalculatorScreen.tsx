import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Delete } from 'lucide-react';

export const CalculatorScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [display, setDisplay] = useState('0');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = (digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  };

  const inputDot = () => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const clearDisplay = () => {
    setDisplay('0');
    setPrevValue(null);
    setOperator(null);
    setWaitingForOperand(false);
  };

  const toggleSign = () => {
    setDisplay((parseFloat(display) * -1).toString());
  };

  const inputPercent = () => {
    setDisplay((parseFloat(display) / 100).toString());
  };

  const performOperation = (nextOperator: string) => {
    const inputValue = parseFloat(display);

    if (prevValue === null) {
      setPrevValue(inputValue);
    } else if (operator) {
      const currentValue = prevValue || 0;
      const newValue = calculate(currentValue, inputValue, operator);
      setPrevValue(newValue);
      setDisplay(newValue.toString());
    }

    setWaitingForOperand(true);
    setOperator(nextOperator);
  };

  const calculate = (prev: number, next: number, op: string) => {
    switch (op) {
      case '+': return prev + next;
      case '-': return prev - next;
      case '×': return prev * next;
      case '÷': return prev / next;
      default: return next;
    }
  };

  const handleEqual = () => {
    const inputValue = parseFloat(display);
    if (operator && prevValue !== null) {
      const newValue = calculate(prevValue, inputValue, operator);
      setDisplay(newValue.toString());
      setPrevValue(null);
      setOperator(null);
      setWaitingForOperand(false);
    }
  };

  const buttons = [
    { label: 'C', type: 'action', onClick: clearDisplay },
    { label: '±', type: 'action', onClick: toggleSign },
    { label: '%', type: 'action', onClick: inputPercent },
    { label: '÷', type: 'operator', onClick: () => performOperation('÷') },
    { label: '7', type: 'number', onClick: () => inputDigit('7') },
    { label: '8', type: 'number', onClick: () => inputDigit('8') },
    { label: '9', type: 'number', onClick: () => inputDigit('9') },
    { label: '×', type: 'operator', onClick: () => performOperation('×') },
    { label: '4', type: 'number', onClick: () => inputDigit('4') },
    { label: '5', type: 'number', onClick: () => inputDigit('5') },
    { label: '6', type: 'number', onClick: () => inputDigit('6') },
    { label: '-', type: 'operator', onClick: () => performOperation('-') },
    { label: '1', type: 'number', onClick: () => inputDigit('1') },
    { label: '2', type: 'number', onClick: () => inputDigit('2') },
    { label: '3', type: 'number', onClick: () => inputDigit('3') },
    { label: '+', type: 'operator', onClick: () => performOperation('+') },
    { label: '0', type: 'number', onClick: () => inputDigit('0'), className: 'col-span-2' },
    { label: '.', type: 'number', onClick: inputDot },
    { label: '=', type: 'operator', onClick: handleEqual },
  ];

  return (
    <div className="w-full h-full bg-black flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 flex items-center">
        <button onClick={onBack} className="p-2 -ml-2 text-white active:scale-95 transition-transform">
          <ChevronLeft size={24} />
        </button>
      </div>

      {/* Display */}
      <div className="flex-1 flex flex-col justify-end px-8 pb-8">
        <div className="text-right text-white text-7xl font-light tracking-tight overflow-hidden whitespace-nowrap">
          {display}
        </div>
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-4 gap-3 px-6 pb-12">
        {buttons.map((btn, index) => (
          <button
            key={index}
            onClick={btn.onClick}
            className={`
              ${btn.className || ''}
              aspect-square rounded-full flex items-center justify-center text-2xl font-medium transition-all active:scale-90
              ${btn.type === 'number' ? 'bg-neutral-800 text-white' : ''}
              ${btn.type === 'action' ? 'bg-neutral-400 text-black' : ''}
              ${btn.type === 'operator' ? 'bg-orange-500 text-white' : ''}
              ${btn.label === '0' ? 'aspect-auto h-full rounded-[40px] px-8 justify-start' : ''}
            `}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
};
