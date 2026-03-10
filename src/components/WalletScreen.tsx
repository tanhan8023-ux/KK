import React, { useState } from 'react';
import { ArrowLeft, CreditCard, Wallet, ArrowUpRight, ArrowDownLeft, Gift, MoreHorizontal, ShieldCheck, Banknote, Landmark, Smartphone, Zap, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { UserProfile, Transaction } from '../types';

interface Props {
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  onBack: () => void;
}

export function WalletScreen({ userProfile, setUserProfile, onBack }: Props) {
  const [showTopUp, setShowTopUp] = useState(false);
  const [amount, setAmount] = useState('');

  const handleTopUp = () => {
    const val = parseFloat(amount);
    if (!isNaN(val) && val > 0) {
      const newTransaction: Transaction = {
        id: Date.now().toString(),
        type: 'top_up',
        amount: val,
        description: '零钱充值',
        timestamp: Date.now()
      };

      setUserProfile(prev => ({
        ...prev,
        balance: (prev.balance || 0) + val,
        transactions: [newTransaction, ...(prev.transactions || [])]
      }));
      setShowTopUp(false);
      setAmount('');
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}-${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      className="absolute inset-0 bg-[#f7f7f7] flex flex-col z-30"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
    >
      {/* Header */}
      <div className="bg-[#ededed] px-4 pt-12 pb-3 flex items-center justify-between border-b border-neutral-200">
        <button onClick={onBack} className="p-1 -ml-2 active:bg-black/5 rounded-full">
          <ArrowLeft size={24} className="text-black" />
        </button>
        <span className="font-medium text-[17px]">支付</span>
        <button className="p-1 -mr-2 active:bg-black/5 rounded-full">
          <MoreHorizontal size={24} className="text-black" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {/* Green Card Section */}
        <div className="bg-[#2aad67] m-2 p-6 rounded-xl text-white shadow-sm relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-6">
              <ShieldCheck size={20} className="opacity-80" />
              <span className="text-sm font-medium opacity-90">收付款</span>
            </div>
            
            <div className="flex justify-between items-end">
              <div>
                <div className="text-sm opacity-80 mb-1">钱包余额 (元)</div>
                <div className="text-4xl font-bold tracking-tight">
                  {userProfile.balance?.toFixed(2) || '0.00'}
                </div>
              </div>
              <button 
                onClick={() => setShowTopUp(true)}
                className="bg-white/20 hover:bg-white/30 active:bg-white/40 backdrop-blur-sm px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
              >
                充值
              </button>
            </div>
          </div>
          
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/5 rounded-full blur-xl"></div>
        </div>

        {/* Services Grid */}
        <div className="bg-white mx-2 rounded-xl p-4 shadow-sm mb-2">
          <h3 className="text-xs text-neutral-500 mb-4 font-medium px-2">金融理财</h3>
          <div className="grid grid-cols-4 gap-y-6">
            <ServiceItem icon={<CreditCard className="text-[#d9a356]" />} label="信用卡还款" />
            <ServiceItem icon={<Landmark className="text-[#d9a356]" />} label="理财通" />
            <ServiceItem icon={<Banknote className="text-[#d9a356]" />} label="保险服务" />
            <ServiceItem icon={<Wallet className="text-[#d9a356]" />} label="借钱" />
          </div>
        </div>

        <div className="bg-white mx-2 rounded-xl p-4 shadow-sm mb-2">
          <h3 className="text-xs text-neutral-500 mb-4 font-medium px-2">生活服务</h3>
          <div className="grid grid-cols-4 gap-y-6">
            <ServiceItem icon={<Smartphone className="text-[#2aad67]" />} label="手机充值" />
            <ServiceItem icon={<Zap className="text-[#2aad67]" />} label="生活缴费" />
            <ServiceItem icon={<Gift className="text-[#e85d5d]" />} label="Q币充值" />
            <ServiceItem icon={<ArrowUpRight className="text-[#2aad67]" />} label="城市服务" />
          </div>
        </div>

        <div className="bg-white mx-2 rounded-xl p-4 shadow-sm mb-2">
          <h3 className="text-xs text-neutral-500 mb-4 font-medium px-2">交通出行</h3>
          <div className="grid grid-cols-4 gap-y-6">
            <ServiceItem icon={<ArrowDownLeft className="text-[#2aad67]" />} label="出行服务" />
            <ServiceItem icon={<ArrowUpRight className="text-[#2aad67]" />} label="火车票机票" />
            <ServiceItem icon={<ArrowDownLeft className="text-[#2aad67]" />} label="滴滴出行" />
            <ServiceItem icon={<ArrowUpRight className="text-[#2aad67]" />} label="酒店" />
          </div>
        </div>

        {/* Transaction History */}
        {userProfile.transactions && userProfile.transactions.length > 0 && (
          <div className="bg-white mx-2 rounded-xl p-4 shadow-sm mb-2">
            <div className="flex items-center gap-2 mb-4 px-2">
              <Clock size={14} className="text-neutral-400" />
              <h3 className="text-xs text-neutral-500 font-medium">最近交易</h3>
            </div>
            <div className="space-y-4">
              {userProfile.transactions.map(tx => (
                <div key={tx.id} className="flex justify-between items-center px-2">
                  <div className="flex flex-col">
                    <span className="text-[15px] text-neutral-900 font-medium">{tx.description}</span>
                    <span className="text-[12px] text-neutral-400">{formatTime(tx.timestamp)}</span>
                  </div>
                  <span className={`text-[16px] font-medium ${tx.type === 'top_up' || tx.type === 'red_packet' ? 'text-[#fa9d3b]' : 'text-neutral-900'}`}>
                    {tx.type === 'top_up' || tx.type === 'red_packet' ? '+' : '-'}{tx.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Top Up Modal */}
      {showTopUp && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-end justify-center overflow-hidden">
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            className="bg-white w-full rounded-t-3xl p-6 pb-10 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-neutral-200 rounded-full mx-auto mb-6"></div>
            <h3 className="text-[17px] font-bold mb-6 text-center">充值金额</h3>
            <div className="flex items-center border-b-2 border-[#2aad67] mb-8 pb-3 px-2">
              <span className="text-3xl font-bold mr-3">¥</span>
              <input 
                type="number" 
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="flex-1 text-4xl font-bold outline-none bg-transparent"
                placeholder="0.00"
                inputMode="decimal"
              />
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowTopUp(false)}
                className="flex-1 py-3.5 bg-neutral-100 rounded-xl font-semibold text-neutral-600 active:bg-neutral-200 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={handleTopUp}
                className="flex-1 py-3.5 bg-[#2aad67] rounded-xl font-semibold text-white active:bg-[#239256] transition-colors shadow-md shadow-green-500/20"
              >
                确认充值
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function ServiceItem({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 active:opacity-60 transition-opacity cursor-pointer">
      <div className="w-8 h-8 flex items-center justify-center">
        {React.cloneElement(icon as React.ReactElement, { size: 28, strokeWidth: 1.5 } as any)}
      </div>
      <span className="text-[12px] text-neutral-600">{label}</span>
    </div>
  );
}
