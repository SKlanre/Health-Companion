import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, Check, Coins, AlertCircle, Sparkles } from 'lucide-react';
import { CURRENCY_DEFINITIONS, CurrencyInfo, getUserCurrency } from '../lib/currencies';
import { UserProfile } from '../types';
import { auth, db, doc, setDoc, handleFirestoreError, OperationType } from '../firebase';

interface CurrencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onCurrencyUpdated?: (newCurrency: CurrencyInfo, newBudget?: number) => void;
}

export const CurrencyModal: React.FC<CurrencyModalProps> = ({
  isOpen,
  onClose,
  profile,
  onCurrencyUpdated,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateBudgetWithCurrency, setUpdateBudgetWithCurrency] = useState(true);
  const [selectedCurrencyCode, setSelectedCurrencyCode] = useState<string>(
    profile.currency || getUserCurrency(profile).code
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const activeCurrency = getUserCurrency(profile);

  // Filter currencies by query
  const filteredCurrencies = CURRENCY_DEFINITIONS.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.symbol.toLowerCase().includes(q) ||
      c.country.toLowerCase().includes(q) ||
      c.adjective.toLowerCase().includes(q)
    );
  });

  const handleSelectCurrency = async (currency: CurrencyInfo) => {
    setSelectedCurrencyCode(currency.code);
    setIsUpdating(true);
    setSuccessMessage(null);

    try {
      const newBudget = updateBudgetWithCurrency ? currency.defaultDailyBudget : profile.dailyBudget;

      // 1. Update Firestore if authenticated
      if (auth.currentUser) {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(
          userDocRef,
          {
            currency: currency.code,
            ...(updateBudgetWithCurrency ? { dailyBudget: newBudget } : {}),
          },
          { merge: true }
        );
      }

      // 2. Notify parent / local state
      if (onCurrencyUpdated) {
        onCurrencyUpdated(currency, newBudget);
      }

      setSuccessMessage(`Currency updated to ${currency.flag} ${currency.name} (${currency.symbol})!`);

      setTimeout(() => {
        setIsUpdating(false);
        onClose();
      }, 700);
    } catch (error) {
      console.error('Failed to update currency:', error);
      if (auth.currentUser) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
      }
      setIsUpdating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-800 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white">Change Currency</h3>
                <p className="text-xs text-gray-400 dark:text-slate-400">
                  Localize meal costs, groceries, and daily budget
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Current Selection & Budget Preference Banner */}
          <div className="px-6 pt-4 pb-2 bg-slate-50/70 dark:bg-slate-950/40 border-b border-gray-100 dark:border-slate-800/60 shrink-0 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-gray-500 dark:text-slate-400">Active Currency:</span>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-800 rounded-full border border-gray-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200 shadow-sm">
                <span>{activeCurrency.flag}</span>
                <span>{activeCurrency.name}</span>
                <span className="text-amber-600 dark:text-amber-400 font-black">({activeCurrency.symbol} {activeCurrency.code})</span>
              </div>
            </div>

            {/* Toggle to also calibrate daily budget */}
            <label className="flex items-center gap-3 cursor-pointer select-none group pb-2">
              <input
                type="checkbox"
                checked={updateBudgetWithCurrency}
                onChange={(e) => setUpdateBudgetWithCurrency(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-slate-700 dark:bg-slate-800"
              />
              <span className="text-xs text-gray-600 dark:text-slate-300 font-medium leading-tight">
                Also adjust daily meal budget to the recommended baseline for chosen currency
              </span>
            </label>

            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{successMessage}</span>
              </motion.div>
            )}
          </div>

          {/* Search Box */}
          <div className="p-4 border-b border-gray-100 dark:border-slate-800 shrink-0">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search currency, country, or code (e.g. Naira, USD, €, GBP)..."
                className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/80 rounded-2xl text-sm font-semibold text-slate-800 dark:text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition-all"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Currency List */}
          <div className="p-4 overflow-y-auto space-y-2 flex-1 divide-y divide-gray-50 dark:divide-slate-800/50">
            {filteredCurrencies.length === 0 ? (
              <div className="text-center py-10">
                <AlertCircle className="w-8 h-8 text-gray-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-bold text-gray-500 dark:text-slate-400">No currency matches "{searchQuery}"</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Try searching by country or 3-letter code</p>
              </div>
            ) : (
              filteredCurrencies.map((c) => {
                const isSelected = selectedCurrencyCode === c.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    disabled={isUpdating}
                    onClick={() => handleSelectCurrency(c)}
                    className={`w-full p-4 rounded-2xl flex items-center justify-between text-left transition-all border ${
                      isSelected
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500/60 shadow-sm'
                        : 'border-transparent hover:bg-gray-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="text-2xl select-none">{c.flag}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-gray-900 dark:text-white">{c.name}</span>
                          <span className="text-xs font-black px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md">
                            {c.code}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                          <span>{c.country}</span> • <span className="font-semibold text-amber-600 dark:text-amber-400">Rec. Daily: {c.symbol}{c.defaultDailyBudget.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-lg font-black text-slate-700 dark:text-slate-200 min-w-[28px] text-right">
                        {c.symbol}
                      </span>
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-gray-200 dark:border-slate-700 text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 dark:hover:bg-slate-700 rounded-xl text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 transition-all"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
