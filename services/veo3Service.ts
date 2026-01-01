
import { v4 as uuidv4 } from 'uuid';
import { executeProxiedRequest } from './apiClient';

interface Veo3Config {
  authToken: string;
  aspectRatio: 'landscape' | 'portrait';
  seed?: number;
  useStandardModel?: boolean;
  serverUrl?: string;
}

interface VideoGenerationRequest {
  prompt: string;
  imageMediaId?: string;
  config: Omit<Veo3Config, 'authToken'> & { authToken?: string };
}

// Helper function to get model keys (ultra and non-ultra)
const getModelKeys = (isImageToVideo: boolean, aspectRatio: 'landscape' | 'portrait') => {
  if (isImageToVideo) {
    return {
      ultra: aspectRatio === 'landscape'
        ? 'veo_3_1_i2v_s_fast_ultra'
        : 'veo_3_1_i2v_s_fast_portrait_ultra',
      nonUltra: aspectRatio === 'landscape'
        ? 'veo_3_1_i2v_s_fast'
        : 'veo_3_1_i2v_s_fast_portrait'
    };
  } else {
    return {
      ultra: aspectRatio === 'landscape'
        ? 'veo_3_1_t2v_fast_ultra'
        : 'veo_3_1_t2v_fast_portrait_ultra',
      nonUltra: aspectRatio === 'landscape'
        ? 'veo_3_1_t2v_fast'
        : 'veo_3_1_t2v_fast_portrait'
    };
  }
};

export const generateVideoWithVeo3 = async (
    request: VideoGenerationRequest,
    onStatusUpdate?: (status: string) => void,
    isHealthCheck = false
): Promise<{ operations: any[]; successfulToken: string; successfulServerUrl: string }> => {
  console.log('🎬 [VEO Service] Preparing generateVideoWithVeo3 request...');
  const { prompt, imageMediaId, config } = request;
  const isImageToVideo = !!imageMediaId;

  const modelKeys = getModelKeys(isImageToVideo, config.aspectRatio);
  let videoModelKey = modelKeys.ultra; // Try ultra first

  // FIX: API requires the full ENUM string
  const aspectRatioValue = config.aspectRatio === 'landscape'
    ? 'VIDEO_ASPECT_RATIO_LANDSCAPE'
    : 'VIDEO_ASPECT_RATIO_PORTRAIT';

  const seed = config.seed || Math.floor(Math.random() * 2147483647);
  const sceneId = uuidv4();
  const projectId = uuidv4(); // Generate unique project ID for this request

  // Helper function to create request body with a specific model key
  const createRequestBody = (modelKey: string) => {
    const body: any = {
      clientContext: {
        sessionId: `;${Date.now()}`, // Required: session ID with timestamp
        projectId: projectId,         // Required: project ID for tracking
        tool: 'PINHOLE',
        userPaygateTier: 'PAYGATE_TIER_TWO'
      },
      requests: [{
        aspectRatio: aspectRatioValue,
        seed: seed,
        textInput: { prompt },
        videoModelKey: modelKey,
        metadata: { sceneId: sceneId }
      }]
    };

    if (imageMediaId) {
      body.requests[0].startImage = { mediaId: imageMediaId };
    }

    return body;
  };

  const relativePath = isImageToVideo ? '/generate-i2v' : '/generate-t2v';
  const logContext = isHealthCheck
    ? (isImageToVideo ? 'VEO I2V HEALTH CHECK' : 'VEO T2V HEALTH CHECK')
    : (isImageToVideo ? 'VEO I2V GENERATE' : 'VEO T2V GENERATE');

  // Try ultra model first
  try {
    const requestBody = createRequestBody(videoModelKey);
    console.log(`🎬 [VEO Service] Attempting with ULTRA model: ${videoModelKey}`);
    
    const { data, successfulToken, successfulServerUrl } = await executeProxiedRequest(
      relativePath,
      'veo',
      requestBody,
      logContext,
      config.authToken, 
      onStatusUpdate,
      config.serverUrl // Pass specific server URL if provided
    );
    
    console.log('🎬 [VEO Service] ✅ ULTRA model succeeded. Operations:', data.operations?.length || 0);
    return { operations: data.operations || [], successfulToken, successfulServerUrl };
    
  } catch (ultraError: any) {
    const errorMsg = ultraError?.message || String(ultraError);
    const lowerMsg = errorMsg.toLowerCase();
    
    // Check if error is related to model access (400, 403, or mentions model/ultra)
    const isModelAccessError = 
      errorMsg.includes('[400]') || 
      errorMsg.includes('[403]') ||
      lowerMsg.includes('model') ||
      lowerMsg.includes('ultra') ||
      lowerMsg.includes('access') ||
      lowerMsg.includes('permission') ||
      lowerMsg.includes('unauthorized');
    
    // Only retry with non-ultra if it's a model access error (not safety block or other errors)
    if (isModelAccessError && !lowerMsg.includes('safety') && !lowerMsg.includes('blocked')) {
      console.warn(`⚠️ [VEO Service] ULTRA model failed (${errorMsg.substring(0, 100)}). Retrying with non-ULTRA model...`);
      
      if (onStatusUpdate) {
        onStatusUpdate('Retrying with standard model...');
      }
      
      // Retry with non-ultra model
      videoModelKey = modelKeys.nonUltra;
      const requestBody = createRequestBody(videoModelKey);
      
      console.log(`🎬 [VEO Service] Retrying with non-ULTRA model: ${videoModelKey}`);
      
      const { data, successfulToken, successfulServerUrl } = await executeProxiedRequest(
        relativePath,
        'veo',
        requestBody,
        logContext,
        config.authToken, 
        onStatusUpdate,
        config.serverUrl
      );
      
      console.log('🎬 [VEO Service] ✅ Non-ULTRA model succeeded. Operations:', data.operations?.length || 0);
      return { operations: data.operations || [], successfulToken, successfulServerUrl };
    }
    
    // If not a model access error, throw the original error
    throw ultraError;
  }
};

export const checkVideoStatus = async (
    operations: any[], 
    token: string, 
    onStatusUpdate?: (status: string) => void,
    serverUrl?: string
) => {
  const payload = { operations };

  const { data } = await executeProxiedRequest(
    '/status',
    'veo',
    payload,
    'VEO STATUS',
    token, // Must use same token as generation
    onStatusUpdate,
    serverUrl // Must use same server as generation
  );
  
  if (data.operations && data.operations.length > 0) {
    data.operations.forEach((op: any, idx: number) => {
      console.log(`📊 Operation ${idx + 1} status:`, {
        status: op.status,
        hasResult: !!(op.result?.generatedVideo || op.result?.generatedVideos),
        hasError: !!op.error,
        operationName: op.name || op.operation?.name
      });
    });
  }

  return data;
};

export const uploadImageForVeo3 = async (
  base64Image: string,
  mimeType: string,
  aspectRatio: 'landscape' | 'portrait',
  onStatusUpdate?: (status: string) => void,
  authToken?: string, // New optional parameter to force a specific token
  serverUrl?: string  // New optional parameter to force a specific server
): Promise<{ mediaId: string; successfulToken: string; successfulServerUrl: string }> => {
  console.log(`📤 [VEO Service] Preparing to upload image for VEO. MimeType: ${mimeType}`);
  // Note: Upload endpoint usually expects the ENUM string, unlike generation endpoint.
  const imageAspectRatioEnum = aspectRatio === 'landscape' 
    ? 'IMAGE_ASPECT_RATIO_LANDSCAPE' 
    : 'IMAGE_ASPECT_RATIO_PORTRAIT';

  const requestBody = {
    imageInput: {
      rawImageBytes: base64Image,
      mimeType: mimeType,
      isUserUploaded: true,
      aspectRatio: imageAspectRatioEnum
    },
    clientContext: {
      sessionId: `;${Date.now()}`, // Required: session ID with timestamp
      tool: 'ASSET_MANAGER'
    }
  };

  const { data, successfulToken, successfulServerUrl } = await executeProxiedRequest(
    '/upload',
    'veo',
    requestBody,
    'VEO UPLOAD',
    authToken, // Use specific token if provided, otherwise null for auto-selection
    onStatusUpdate,
    serverUrl // Use specific server if provided
  );

  const mediaId = data.mediaGenerationId?.mediaGenerationId || data.mediaId;
  
  if (!mediaId) {
    console.error('❌ No mediaId in response:', JSON.stringify(data, null, 2));
    throw new Error('Upload succeeded but no mediaId returned');
  }
  
  console.log(`📤 [VEO Service] Image upload successful. Media ID: ${mediaId} with token ...${successfulToken.slice(-6)}`);
  return { mediaId, successfulToken, successfulServerUrl };
};
