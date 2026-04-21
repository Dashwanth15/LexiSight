// Gesture map: word/letter → HandAvatar pose class + display name
// Covers ISL alphabet A-Z, digits 0-9, and common words

export const GESTURE_CLASSES = [
  // Digits
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  // Letters
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
  'U', 'V', 'W', 'X', 'Y', 'Z'
]

// Map gesture label → avatar pose
export const gestureToAvatarPose = {
  // Common words
  'HELLO': 'hello',
  'HELP': 'help',
  'YES': 'yes',
  'NO': 'no',
  'THANK YOU': 'thankyou',
  'PLEASE': 'please',
  'SORRY': 'sorry',
  'STOP': 'stop',
  'GO': 'go',
  'GOOD': 'good',
  'BAD': 'bad',
  'WATER': 'water',
  'FOOD': 'food',
  'PAIN': 'pain',
  'COME': 'come',
  'SIT': 'sit',
  'STAND': 'stand',
  'EAT': 'eat',
  'DRINK': 'drink',
  'SLEEP': 'sleep',
  // Letters use their own class
  'A': 'letter-a', 'B': 'letter-b', 'C': 'letter-c',
  'D': 'letter-d', 'E': 'letter-e', 'F': 'letter-f',
  'G': 'letter-g', 'H': 'letter-h', 'I': 'letter-i',
  'J': 'letter-j', 'K': 'letter-k', 'L': 'letter-l',
  'M': 'letter-m', 'N': 'letter-n', 'O': 'letter-o',
  'P': 'letter-p', 'Q': 'letter-q', 'R': 'letter-r',
  'S': 'letter-s', 'T': 'letter-t', 'U': 'letter-u',
  'V': 'letter-v', 'W': 'letter-w', 'X': 'letter-x',
  'Y': 'letter-y', 'Z': 'letter-z',
  // Digits
  '0': 'digit-0', '1': 'digit-1', '2': 'digit-2',
  '3': 'digit-3', '4': 'digit-4', '5': 'digit-5',
  '6': 'digit-6', '7': 'digit-7', '8': 'digit-8',
  '9': 'digit-9',
}

// Map speech transcript word → gesture label
export const wordToGesture = {
  'hello': 'HELLO', 'hi': 'HELLO', 'hey': 'HELLO',
  'help': 'HELP', 'assist': 'HELP',
  'yes': 'YES', 'yeah': 'YES', 'yep': 'YES',
  'no': 'NO', 'nope': 'NO',
  'thank': 'THANK YOU', 'thanks': 'THANK YOU',
  'please': 'PLEASE',
  'sorry': 'SORRY',
  'stop': 'STOP', 'halt': 'STOP',
  'go': 'GO', 'move': 'GO',
  'good': 'GOOD', 'great': 'GOOD',
  'bad': 'BAD',
  'water': 'WATER',
  'food': 'FOOD', 'eat': 'EAT', 'hungry': 'FOOD',
  'pain': 'PAIN', 'hurt': 'PAIN',
  'come': 'COME',
  'sit': 'SIT', 'down': 'SIT',
  'stand': 'STAND', 'up': 'STAND',
  'drink': 'DRINK',
  'sleep': 'SLEEP', 'tired': 'SLEEP',
}

// Demo mode gesture cycle sequence
export const DEMO_SEQUENCE = [
  { label: 'HELLO', confidence: 0.97 },
  { label: 'YES', confidence: 0.94 },
  { label: 'NO', confidence: 0.91 },
  { label: 'STOP', confidence: 0.96 },
  { label: 'HELP', confidence: 0.89 },
  { label: 'THANK YOU', confidence: 0.92 },
  { label: 'WATER', confidence: 0.88 },
  { label: 'A', confidence: 0.95 },
  { label: 'B', confidence: 0.93 },
  { label: 'C', confidence: 0.90 },
  { label: 'GO', confidence: 0.87 },
  { label: 'GOOD', confidence: 0.96 },
  { label: '1', confidence: 0.98 },
  { label: '2', confidence: 0.94 },
]
