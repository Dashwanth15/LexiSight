// Gesture map: word/letter → HandAvatar pose class + display name
// Covers ISL alphabet A-Z, digits 0-9, common words, and two-hand signs

export const GESTURE_CLASSES = [
  // Digits
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  // Letters
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
  'U', 'V', 'W', 'X', 'Y', 'Z',
  // Common words (single-hand)
  'HELLO', 'YES', 'NO', 'HELP', 'STOP', 'GO', 'GOOD', 'BAD',
  'THANK YOU', 'PLEASE', 'SORRY', 'WATER', 'FOOD', 'PAIN',
  'COME', 'EAT', 'DRINK', 'SLEEP', 'SIT', 'STAND', 'ILY', 'WHAT',
  // Medical pack
  'DOCTOR', 'MEDICINE', 'HURT',
  // Workplace pack
  'WORK', 'MEET', 'NAME', 'QUESTION', 'UNDERSTAND', 'AGAIN',
  // Two-hand signs (detected via geometric classifier)
  'FRIEND', 'TOGETHER', 'FAMILY', 'MORE', 'SCHOOL', 'LOVE',
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
  // Greetings
  'hello': 'HELLO', 'hi': 'HELLO', 'hey': 'HELLO',
  'yes': 'YES', 'yeah': 'YES', 'yep': 'YES', 'correct': 'YES', 'right': 'YES',
  'no': 'NO', 'nope': 'NO', 'nah': 'NO', 'wrong': 'NO',
  'thank': 'THANK YOU', 'thanks': 'THANK YOU', 'thankyou': 'THANK YOU',
  'please': 'PLEASE',
  'sorry': 'SORRY', 'apologize': 'SORRY', 'excuse': 'SORRY',
  'good': 'GOOD', 'great': 'GOOD', 'nice': 'GOOD', 'well': 'GOOD',
  'bad': 'BAD', 'wrong': 'BAD', 'poor': 'BAD',
  // Actions
  'help': 'HELP', 'assist': 'HELP', 'assist': 'HELP',
  'stop': 'STOP', 'halt': 'STOP', 'wait': 'STOP', 'pause': 'STOP',
  'go': 'GO', 'move': 'GO', 'continue': 'GO', 'proceed': 'GO',
  'come': 'COME', 'approach': 'COME',
  'sit': 'SIT', 'down': 'SIT',
  'stand': 'STAND', 'up': 'STAND', 'rise': 'STAND',
  // Needs
  'water': 'WATER', 'drink': 'DRINK', 'thirsty': 'WATER',
  'food': 'FOOD', 'eat': 'EAT', 'hungry': 'EAT', 'meal': 'FOOD',
  'sleep': 'SLEEP', 'tired': 'SLEEP', 'rest': 'SLEEP',
  'pain': 'PAIN', 'hurt': 'PAIN', 'ache': 'PAIN',
  // Medical
  'doctor': 'DOCTOR', 'physician': 'DOCTOR', 'nurse': 'DOCTOR',
  'medicine': 'MEDICINE', 'medication': 'MEDICINE', 'drug': 'MEDICINE',
  // Workplace
  'work': 'WORK', 'job': 'WORK', 'task': 'WORK',
  'meet': 'MEET', 'meeting': 'MEET',
  'name': 'NAME',
  'question': 'QUESTION', 'ask': 'QUESTION',
  'understand': 'UNDERSTAND', 'understood': 'UNDERSTAND', 'get': 'UNDERSTAND',
  'again': 'AGAIN', 'repeat': 'AGAIN', 'once more': 'AGAIN',
  // Two-hand signs
  'friend': 'FRIEND', 'buddy': 'FRIEND',
  'together': 'TOGETHER', 'with': 'TOGETHER',
  'family': 'FAMILY', 'relatives': 'FAMILY',
  'more': 'MORE', 'additional': 'MORE',
  'school': 'SCHOOL', 'class': 'SCHOOL', 'college': 'SCHOOL',
  'love': 'LOVE', 'like': 'LOVE',
  // Questions
  'what': 'WHAT',
}

// Demo mode gesture cycle sequence
export const DEMO_SEQUENCE = [
  { label: 'HELLO', confidence: 0.97 },
  { label: 'YES', confidence: 0.94 },
  { label: 'NO', confidence: 0.91 },
  { label: 'STOP', confidence: 0.96 },
  { label: 'HELP', confidence: 0.89 },
  { label: 'THANK YOU', confidence: 0.92 },
  { label: 'PLEASE', confidence: 0.90 },
  { label: 'SORRY', confidence: 0.88 },
  { label: 'WATER', confidence: 0.88 },
  { label: 'PAIN', confidence: 0.85 },
  { label: 'GOOD', confidence: 0.96 },
  { label: 'ILY', confidence: 0.93 },
  { label: 'FRIEND', confidence: 0.87 },
  { label: 'FAMILY', confidence: 0.85 },
  { label: 'A', confidence: 0.95 },
  { label: 'B', confidence: 0.93 },
  { label: 'C', confidence: 0.90 },
  { label: 'L', confidence: 0.91 },
  { label: 'V', confidence: 0.94 },
  { label: 'GO', confidence: 0.87 },
  { label: '1', confidence: 0.98 },
  { label: '2', confidence: 0.94 },
  { label: '5', confidence: 0.97 },
  { label: 'UNDERSTAND', confidence: 0.86 },
  { label: 'WORK', confidence: 0.84 },
]
