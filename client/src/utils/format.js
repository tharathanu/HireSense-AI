export const STAGES = ['SCREENING', 'APTITUDE', 'GROUP_DISCUSSION', 'INTERVIEW', 'FINAL_REVIEW'];

export const STAGE_LABEL = {
  SCREENING: 'Resume screening',
  APTITUDE: 'Aptitude test',
  GROUP_DISCUSSION: 'Group discussion',
  INTERVIEW: 'Interview',
  FINAL_REVIEW: 'Final review',
};

export const STATUS_LABEL = {
  IN_PROGRESS: 'In progress',
  SHORTLISTED: 'Shortlisted',
  REJECTED: 'Not selected',
  HIRED: 'Selected',
  WITHDRAWN: 'Withdrawn',
};

export const RECOMMENDATION_LABEL = {
  STRONG_HIRE: 'Strong hire',
  HIRE: 'Hire',
  MAYBE: 'Maybe',
  REJECT: 'Not recommended',
};

export const CATEGORY_LABEL = {
  QUANTITATIVE: 'Quantitative',
  LOGICAL: 'Logical',
  VERBAL: 'Verbal',
  TECHNICAL: 'Technical',
};

export const VIOLATION_LABEL = {
  TAB_SWITCH: 'Switched tab or window',
  FULLSCREEN_EXIT: 'Left fullscreen',
  COPY_PASTE: 'Tried to copy or paste',
  PHONE_DETECTED: 'Phone detected on camera',
  NO_FACE: 'No face visible',
  MULTIPLE_FACES: 'More than one face visible',
  LOOKING_AWAY: 'Looking away from the screen',
  CAMERA_OFF: 'Camera turned off',
};

export const EVENT_LABEL = {
  APTITUDE_TEST: 'Aptitude test',
  GROUP_DISCUSSION: 'Group discussion',
  INTERVIEW: 'Voice interview',
};

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function timeAgo(value) {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

export function formatClock(totalSeconds) {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// Value for <input type="datetime-local"> from a Date
export function toLocalInput(date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function scoreTone(score) {
  if (score === null || score === undefined) return 'neutral';
  if (score >= 75) return 'good';
  if (score >= 50) return 'fair';
  return 'low';
}
