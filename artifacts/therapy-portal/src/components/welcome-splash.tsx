import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import logoUrl from '@assets/ATS_FALL_1786003864019.png';

export function WelcomeSplash({ name, storageKey = 'ats-welcome-seen' }: { name: string; storageKey?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const alreadySeen = window.sessionStorage.getItem(storageKey);
    if (alreadySeen) return;
    window.sessionStorage.setItem(storageKey, 'true');
    setVisible(true);
    const timeout = window.setTimeout(() => setVisible(false), 1350);
    return () => window.clearTimeout(timeout);
  }, [storageKey]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-6 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35 } }}
        >
          <motion.div
            className="flex max-w-sm flex-col items-center text-center"
            initial={{ y: 24, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.img
              src={logoUrl}
              alt="Ayden's Therapy Services"
              className="mb-7 h-28 w-28 rounded-[2rem] object-cover shadow-xl ring-1 ring-primary/15"
              animate={{ y: [0, -6, 0], rotate: [0, -1.5, 1.5, 0] }}
              transition={{ duration: 2.4, ease: 'easeInOut', repeat: Infinity }}
            />
            <p className="mb-2 text-xs font-semibold uppercase tracking-[.24em] text-primary">A clear space to care</p>
            <h1 className="font-serif text-4xl font-semibold tracking-tight">Welcome back, {name}.</h1>
            <p className="mt-3 text-muted-foreground">Take a breath. You are exactly where you need to be.</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}