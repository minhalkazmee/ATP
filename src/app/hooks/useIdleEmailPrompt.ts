import { useEffect, type RefObject, type Dispatch, type SetStateAction } from 'react';

const IDLE_MS = 30_000;

export function useIdleEmailPrompt(
  open: boolean,
  setOpen: Dispatch<SetStateAction<boolean>>,
  inquiryOpenRef: RefObject<boolean>,
) {
  useEffect(() => {
    if (open || localStorage.getItem('ac_email') || sessionStorage.getItem('atp_profile_dismissed')) return;

    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (document.hidden || inquiryOpenRef.current || localStorage.getItem('ac_email')) {
          schedule();
          return;
        }
        setOpen(true);
      }, IDLE_MS);
    };
    const onVisibilityChange = () => { if (!document.hidden) schedule(); };

    schedule();
    window.addEventListener('mousemove', schedule, { passive: true });
    window.addEventListener('keydown', schedule);
    window.addEventListener('touchstart', schedule, { passive: true });
    window.addEventListener('touchmove', schedule, { passive: true });
    window.addEventListener('scroll', schedule, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', schedule);
      window.removeEventListener('keydown', schedule);
      window.removeEventListener('touchstart', schedule);
      window.removeEventListener('touchmove', schedule);
      window.removeEventListener('scroll', schedule);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [open, setOpen, inquiryOpenRef]);
}
