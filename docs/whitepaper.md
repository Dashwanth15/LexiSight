# LexiSight: Bridging the Communication Gap for India’s Deaf Community

**Abstract**  
Over 63 million people in India experience significant hearing loss, relying heavily on Indian Sign Language (ISL) for daily communication. However, the lack of widespread ISL literacy among the hearing population creates severe social, educational, and medical access barriers. LexiSight is an offline-first, browser-based accessibility platform that addresses this gap. By utilizing on-device machine learning (TensorFlow.js and MediaPipe) for real-time sign-to-speech translation, and a 3D avatar for speech-to-sign conversion, LexiSight enables bidirectional communication with zero latency, zero server costs, and absolute privacy.

---

## 1. Introduction

### The Problem
The Deaf and Hard of Hearing (DHH) community in India faces systemic exclusion in critical areas:
- **Healthcare**: Miscommunication in hospitals leads to misdiagnosis or incorrect treatment.
- **Education**: 90% of Deaf children in India are born to hearing parents who do not know sign language.
- **Employment**: Communication barriers result in disproportionate unemployment rates among the DHH population.

### The LexiSight Solution
LexiSight transforms any standard smartphone, tablet, or laptop into a real-time ISL translator. Unlike existing solutions that require expensive proprietary hardware, cloud API subscriptions, or high-bandwidth internet connections, LexiSight runs entirely within the web browser. 

---

## 2. Technical Architecture

LexiSight is built on three core technical pillars:

### 2.1. Vision-Based Feature Extraction
Using Google’s MediaPipe framework, LexiSight extracts 21 3D landmarks per hand at 30 frames per second. This approach distills high-resolution video streams down to just 126 coordinate features (2 hands × 21 landmarks × 3 dimensions). This achieves two goals:
1. **Privacy**: No camera frames are ever saved or transmitted.
2. **Efficiency**: The neural network only processes coordinate data, not raw pixels, reducing computational load by 99%.

### 2.2. Temporal Sequence Modeling
ISL relies heavily on motion. A static hand shape can mean multiple different things depending on how it moves. LexiSight v1.0 utilizes a **Temporal Landmark Transformer**:
- **Input**: A 30-frame sliding window representing 1 second of motion.
- **Network**: Pre-norm Transformer encoder blocks with learned positional embeddings.
- **Size**: With just ~300K parameters, the model exports to a 0.6 MB `float16` payload that loads instantly on mobile devices.

### 2.3. Offline-First Progressive Web App (PWA)
LexiSight is deployed as a PWA. Once a user visits `lexisight.app`, the HTML, CSS, JavaScript, and Machine Learning models are cached locally. Subsequent uses require absolutely no internet connection, making the platform viable in rural or low-connectivity environments.

---

## 3. Core Features

### Bidirectional Translation
- **Sign-to-Speech**: The camera tracks the user's ISL gestures. The Temporal Transformer predicts the word, which is then fed into a Sentence Builder equipped with an ISL-to-English grammar heuristic, and spoken aloud using the Web Speech Synthesis API.
- **Speech-to-Sign**: Hearing users speak into the microphone. The Web Speech Recognition API transcribes the audio, and the system maps the English transcript back to ISL, animating a 3D on-screen avatar to sign back to the DHH user.

### Dynamic Vocabulary & Localization
LexiSight v1.0 supports over 250 common ISL words sourced from the INCLUDE and CISLR datasets. To ensure accessibility across India's linguistic landscape, the output speech supports multiple regional languages via real-time translation and native text-to-speech synthesis (including Hindi, Tamil, Telugu, Bengali, and Marathi).

---

## 4. Impact & Future Roadmap

### Alignment with UN Sustainable Development Goals (SDGs)
- **SDG 3 (Good Health & Well-being)**: Enabling direct communication between doctors and Deaf patients.
- **SDG 4 (Quality Education)**: Facilitating classroom integration and at-home learning.
- **SDG 10 (Reduced Inequalities)**: Breaking down daily social barriers.

### Deployment Strategy
1. **Phase 1 (Current)**: Open-source repository and public browser demo.
2. **Phase 2 (Pilot)**: Deployment in select medical clinics and DHH educational institutions in Hyderabad to gather real-world wild-test data and feedback.
3. **Phase 3 (Scale)**: Integration of a sentence-level continuous translation model (utilizing the iSign dataset) and expansion to support regional sign language dialects.

### Conclusion
LexiSight demonstrates that advanced AI does not require massive server infrastructure. By pushing inference to the edge and respecting user privacy, we can deliver life-changing accessibility tools at zero marginal cost per user.
