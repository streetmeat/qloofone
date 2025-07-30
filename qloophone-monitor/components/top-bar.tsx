import React from "react";
import Image from "next/image";

const TopBar = () => {
  return (
    <div className="flex justify-between items-center px-6 py-2 bg-white/5 backdrop-blur-md border-b border-white/10 transition-all duration-300">
      <div className="flex items-center gap-6">
        <img
          src="/qloo.png"
          alt="Qloo"
          className="h-8 w-auto opacity-90"
        />
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent2 animate-pulse shadow-[0_0_8px_var(--clr-accent2)]" />
          <span className="font-mono text-accent2 text-lg tracking-widest">1-877-361-7566</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-gray-400 text-sm">Real-time Call Control</span>
      </div>
    </div>
  );
};

export default TopBar;