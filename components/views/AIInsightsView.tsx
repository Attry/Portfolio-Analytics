
import React, { useState } from 'react';
import { BrainCircuit, Loader2, Sparkles } from 'lucide-react';
import { analyzePortfolio } from '../../services/geminiService';
import { Trade } from '../../types';

interface AIInsightsViewProps {
    trades: Trade[];
}

export const AIInsightsView: React.FC<AIInsightsViewProps> = ({ trades }) => {
    const [chatQuery, setChatQuery] = useState('');
    const [chatResponse, setChatResponse] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleAnalysis = async () => {
        if (!chatQuery.trim()) return;
        setIsAnalyzing(true);
        setChatResponse(null);
        try {
            const response = await analyzePortfolio(trades, chatQuery);
            setChatResponse(response);
        } catch (error) {
            setChatResponse("Failed to generate response.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
                <div className="glass-card rounded-2xl p-8 border border-primary/20 bg-gradient-to-b from-primary/5 to-transparent text-center">
                <BrainCircuit className="w-12 h-12 text-primary-glow mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2">AI Portfolio Analyst</h3>
                <p className="text-gray-400 mb-6">Ask Gemini anything about your trades, performance, or strategy.</p>
                
                <div className="relative">
                    <textarea 
                        value={chatQuery}
                        onChange={(e) => setChatQuery(e.target.value)}
                        placeholder="e.g., Analyze my trade history for patterns..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-primary/50 transition-colors h-32 resize-none"
                    />
                    <button 
                        onClick={handleAnalysis}
                        disabled={isAnalyzing || !chatQuery.trim()}
                        className="absolute bottom-4 right-4 bg-primary hover:bg-primary-glow text-white px-4 py-2 rounded-lg font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isAnalyzing ? <Loader2 className="animate-spin w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                        Analyze
                    </button>
                </div>
                </div>

                {chatResponse && (
                    <div className="glass-card rounded-2xl p-6 border border-white/10 animate-fade-in">
                        <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/8/8a/Google_Gemini_logo.svg" alt="Gemini" className="w-6 h-6" />
                            Analysis Result
                        </h4>
                        <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed whitespace-pre-line">
                            {chatResponse}
                        </div>
                    </div>
                )}
        </div>
    );
};
