/**
 * AudioWorklet processor that converts Float32 audio samples to PCM Int16
 * and sends them to the main thread for transmission to the Gemini Live API.
 */
class PCMProcessor extends AudioWorkletProcessor {
    process(inputs) {
        const input = inputs[0];
        if (input && input[0] && input[0].length > 0) {
            const float32 = input[0];
            const int16 = new Int16Array(float32.length);
            for (let i = 0; i < float32.length; i++) {
                // Clamp to [-1, 1] then scale to Int16 range
                const clamped = Math.max(-1, Math.min(1, float32[i]));
                int16[i] = clamped * 32767;
            }
            this.port.postMessage(int16.buffer, [int16.buffer]);
        }
        return true; // keep processor alive
    }
}

registerProcessor('pcm-processor', PCMProcessor);
