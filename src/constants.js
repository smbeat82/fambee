export const ROOMS = [
  { id: 'family', name: '우리 가족', emoji: '🐝', members: ['dad', 'mom', 'hayeon'], isGroup: true },
  { id: 'dad_hayeon', name: '하연이', emoji: '👧', members: ['dad', 'hayeon'], isGroup: false },
  { id: 'dad_mom', name: '엄마', emoji: '👩', members: ['dad', 'mom'], isGroup: false },
  { id: 'mom_hayeon', name: '하연이', emoji: '👧', members: ['mom', 'hayeon'], isGroup: false },
];

export const FAMILY = [
  { id: 'dad', name: '아빠', emoji: '🧔' },
  { id: 'mom', name: '엄마', emoji: '👩' },
  { id: 'hayeon', name: '하연이', emoji: '👧' },
];

export const getCollectionName = (roomId) =>
  roomId === 'family' ? 'messages' : `messages_${roomId}`;

export const getRoomForMembers = (id1, id2) => {
  const key = [id1, id2].sort().join('_');
  return ROOMS.find(r => r.id === key) || null;
};
