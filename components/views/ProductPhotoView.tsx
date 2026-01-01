
import React, { useState, useCallback, useEffect } from 'react';
import ImageUpload from '../common/ImageUpload';
import { type MultimodalContent } from '../../services/geminiService';
import { addHistoryItem } from '../../services/historyService';
import Spinner from '../common/Spinner';
import { CameraIcon, DownloadIcon, WandIcon, VideoIcon, AlertTriangleIcon, RefreshCwIcon, UsersIcon } from '../Icons';
import TwoColumnLayout from '../common/TwoColumnLayout';
import { getProductPhotoPrompt } from '../../services/promptManager';
import { type Language, type User } from '../../types';
import { getTranslations } from '../../services/translations';
import { editOrComposeWithImagen } from '../../services/imagenV3Service';
import { handleApiError } from '../../services/errorHandler';
import { incrementImageUsage } from '../../services/userService';
import CreativeDirectionPanel from '../common/CreativeDirectionPanel';
import { getInitialCreativeDirectionState, type CreativeDirectionState } from '../../services/creativeDirectionService';
import { UI_SERVER_LIST } from '../../services/serverConfig';

// --- CONFIG FOR PARALLEL GENERATION ---
const SERVERS = UI_SERVER_LIST;

const triggerDownload = (data: string, fileNameBase: string) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${data}`;
    link.download = `${fileNameBase}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

interface VideoGenPreset {
  prompt: string;
  image: { base64: string; mimeType: string; };
}

interface ImageEditPreset {
  base64: string;
  mimeType: string;
}

interface ProductPhotoViewProps {
  onReEdit: (preset: ImageEditPreset) => void;
  onCreateVideo: (preset: VideoGenPreset) => void;
  language: Language;
  currentUser: User;
  onUserUpdate: (user: User) => void;
}

const SESSION_KEY = 'productPhotoState';

type ImageSlot = string | { error: string } | null;

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div>
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
        {children}
    </div>
);

const ProductPhotoView: React.FC<ProductPhotoViewProps> = ({ onReEdit, onCreateVideo, language, currentUser, onUserUpdate }) => {
  const [productImage, setProductImage] = useState<MultimodalContent | null>(null);
  const [images, setImages] = useState<ImageSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const [creativeState, setCreativeState] = useState<CreativeDirectionState>(getInitialCreativeDirectionState());
  const [customPrompt, setCustomPrompt] = useState('');
  const [numberOfImages, setNumberOfImages] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '9:16' | '16:9'>('9:16');
  const [imageUploadKey, setImageUploadKey] = useState(Date.now());
  const [progress, setProgress] = useState(0);
  
  const T = getTranslations().productPhotoView;
  const commonT = getTranslations().common;

  useEffect(() => {
    try {
        const savedState = sessionStorage.getItem(SESSION_KEY);
        if (savedState) {
            const state = JSON.parse(savedState);
            if (state.creativeState) setCreativeState(state.creativeState);
            if (state.customPrompt) setCustomPrompt(state.customPrompt);
            if (state.numberOfImages) setNumberOfImages(state.numberOfImages);
            if (state.aspectRatio) setAspectRatio(state.aspectRatio);
        }
    } catch (e) { console.error("Failed to load state from session storage", e); }
  }, []);

  useEffect(() => {
    try {
        const stateToSave = {
            creativeState, customPrompt, numberOfImages, aspectRatio
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(stateToSave));
    } catch (e: any) {
        if (e.name !== 'QuotaExceededError' && e.code !== 22) {
            console.error("Failed to save state to session storage", e);
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creativeState, customPrompt, numberOfImages, aspectRatio]);

  const handleRemoveImage = useCallback(() => {
    setProductImage(null);
  }, []);

  const performGeneration = async (serverUrl?: string) => {
      if (!productImage) throw new Error("No product image provided");

      const prompt = getProductPhotoPrompt({
          customPrompt,
          creativeDirection: creativeState
      });

      const result = await editOrComposeWithImagen({
          prompt,
          images: [{ ...productImage, category: 'MEDIA_CATEGORY_SUBJECT', caption: 'product' }],
          config: { 
              aspectRatio,
              serverUrl: serverUrl // Pass server URL for multi-server distribution
          }
      });
      const imageBase64 = result.imagePanels?.[0]?.generatedImages?.[0]?.encodedImage;
      
      if (!imageBase64) {
          throw new Error("The AI did not return an image. Please try a different prompt.");
      }
      
      return { imageBase64, prompt };
  };

  // Optimized function that uses pre-uploaded media ID
  const generateOneImageWithMediaId = useCallback(async (
    index: number, 
    serverUrl: string | undefined,
    productMediaId: string,
    authToken: string | undefined,
    mediaServerUrl: string | undefined
  ) => {
    if (!productMediaId) return;

    try {
        const prompt = getProductPhotoPrompt({
            customPrompt,
            creativeDirection: creativeState
        });

        const { runImageRecipe } = await import('../../services/imagenV3Service');
        const result = await runImageRecipe({
            userInstruction: prompt,
            recipeMediaInputs: [{
                caption: 'product',
                mediaInput: {
                    mediaCategory: 'MEDIA_CATEGORY_SUBJECT',
                    mediaGenerationId: productMediaId
                }
            }],
            config: {
                aspectRatio,
                authToken: authToken,
                serverUrl: serverUrl || mediaServerUrl
            }
        });
        
        const imageBase64 = result.imagePanels?.[0]?.generatedImages?.[0]?.encodedImage;
        
        if (!imageBase64) {
            throw new Error("The AI did not return an image. Please try a different prompt.");
        }
        
        await addHistoryItem({
            type: 'Image',
            prompt: `Product Photo: ${prompt.substring(0, 50)}...`,
            result: imageBase64
        });
        
        const updateResult = await incrementImageUsage(currentUser);
        if (updateResult.success && updateResult.user) {
            onUserUpdate(updateResult.user);
        }

        setImages(prev => {
            const newImages = [...prev];
            newImages[index] = imageBase64;
            return newImages;
        });
        setProgress(prev => prev + 1);

    } catch (e) {
        const errorMessage = handleApiError(e);
        setImages(prev => {
            const newImages = [...prev];
            newImages[index] = { error: errorMessage };
            return newImages;
        });
        setProgress(prev => prev + 1);
    }
  }, [creativeState, customPrompt, aspectRatio, currentUser, onUserUpdate]);

  const generateOneImage = useCallback(async (index: number, serverUrl?: string) => {
    if (!productImage) return;

    try {
        const { imageBase64, prompt } = await performGeneration(serverUrl);
        
        await addHistoryItem({
            type: 'Image',
            prompt: `Product Photo: ${prompt.substring(0, 50)}...`,
            result: imageBase64
        });
        
        const updateResult = await incrementImageUsage(currentUser);
        if (updateResult.success && updateResult.user) {
            onUserUpdate(updateResult.user);
        }

        setImages(prev => {
            const newImages = [...prev];
            newImages[index] = imageBase64;
            return newImages;
        });
        setProgress(prev => prev + 1);

    } catch (e) {
        const errorMessage = handleApiError(e);
        setImages(prev => {
            const newImages = [...prev];
            newImages[index] = { error: errorMessage };
            return newImages;
        });
        setProgress(prev => prev + 1);
    }
  }, [productImage, creativeState, customPrompt, aspectRatio, currentUser, onUserUpdate]);

  const handleGenerate = useCallback(async () => {
    if (!productImage) {
      setError("Please upload a product image first.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setImages(Array(numberOfImages).fill(null));
    setSelectedImageIndex(0);
    setProgress(0);

    // OPTIMIZATION: Upload product image ONCE and reuse media ID for all images (if numberOfImages > 1)
    let sharedProductMediaId: string | null = null;
    let sharedToken: string | undefined;
    let sharedServerUrl: string | undefined;
    
    if (numberOfImages > 1) {
        try {
            const { uploadImageForImagen } = await import('../../services/imagenV3Service');
            const { cropImageToAspectRatio } = await import('../../services/imageService');
            
            let processedBase64 = productImage.base64;
            try {
                processedBase64 = await cropImageToAspectRatio(productImage.base64, aspectRatio || '1:1');
            } catch (cropError) {
                console.warn('Failed to process product image, using original', cropError);
            }
            
            const uploadResult = await uploadImageForImagen(
                processedBase64,
                productImage.mimeType
            );
            sharedProductMediaId = uploadResult.mediaId;
            sharedToken = uploadResult.successfulToken;
            sharedServerUrl = uploadResult.successfulServerUrl;
            console.log(`📤 [Optimization] Uploaded product image once. MediaId: ${sharedProductMediaId.substring(0, 20)}...`);
        } catch (uploadError) {
            console.error('Failed to upload shared product image:', uploadError);
            // Fallback to original method
            sharedProductMediaId = null;
        }
    }

    // Check if user selected localhost server
    const selectedServer = sessionStorage.getItem('selectedProxyServer');
    const isLocalhost = selectedServer?.includes('localhost');
    
    // Multi-Server Distribution: Randomly distribute requests across different servers
    // If user selected localhost, use localhost for all requests (no distribution)
    const serverUrls: (string | undefined)[] = [];
    
    if (isLocalhost) {
        // User selected localhost - use localhost for all requests
        for (let i = 0; i < numberOfImages; i++) {
            serverUrls.push(selectedServer);
        }
        console.log(`🚀 [Localhost] Using localhost server for all ${numberOfImages} image generation requests`);
    } else {
        // Filter out localhost server for production multi-server distribution
        const availableServers = UI_SERVER_LIST
            .map(s => s.url)
            .filter(url => !url.includes('localhost'));
        
        if (availableServers.length > 0) {
            for (let i = 0; i < numberOfImages; i++) {
                // Randomly select a server for each image
                const randomIndex = Math.floor(Math.random() * availableServers.length);
                serverUrls.push(availableServers[randomIndex]);
            }
        } else {
            for (let i = 0; i < numberOfImages; i++) {
                serverUrls.push(undefined);
            }
        }
        console.log(`🚀 [Multi-Server] Randomly distributing ${numberOfImages} image generation requests across ${availableServers.length} servers:`, serverUrls);
    }

    const promises = [];
    for (let i = 0; i < numberOfImages; i++) {
        promises.push(new Promise<void>(resolve => {
            setTimeout(async () => {
                // Use optimized method if media ID is available, otherwise use original
                if (sharedProductMediaId && numberOfImages > 1) {
                    await generateOneImageWithMediaId(i, serverUrls[i], sharedProductMediaId, sharedToken, sharedServerUrl);
                } else {
                    await generateOneImage(i, serverUrls[i]);
                }
                resolve();
            }, i * 500);
        }));
    }

    await Promise.all(promises);

    setIsLoading(false);
  }, [numberOfImages, productImage, generateOneImage, aspectRatio]);
  
  const handleRetry = useCallback(async (index: number) => {
    setImages(prev => {
        const newImages = [...prev];
        newImages[index] = null;
        return newImages;
    });
    await generateOneImage(index);
  }, [generateOneImage]);

  const handleReset = useCallback(() => {
    setProductImage(null);
    setImages([]);
    setError(null);
    setCreativeState(getInitialCreativeDirectionState());
    setCustomPrompt('');
    setNumberOfImages(1);
    setAspectRatio('9:16');
    setImageUploadKey(Date.now());
    setProgress(0);
    sessionStorage.removeItem(SESSION_KEY);
  }, []);

  const leftPanel = (
    <>
      <div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">{T.title}</h1>
        <p className="text-sm sm:text-base text-neutral-500 dark:text-neutral-400 mt-1">{T.subtitle}</p>
      </div>

      <Section title={T.uploadProduct}>
        <ImageUpload key={imageUploadKey} id="product-photo-upload" onImageUpload={(base64, mimeType) => setProductImage({ base64, mimeType })} onRemove={handleRemoveImage} title={T.uploadTitle} language={language} />
      </Section>

      <Section title={T.customPrompt}>
        <textarea
          id="custom-prompt"
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder={T.customPromptPlaceholder}
          rows={3}
          className="w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg p-3 text-sm text-neutral-800 dark:text-neutral-300 focus:ring-2 focus:ring-primary-500 focus:outline-none transition"
        />
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{T.customPromptHelp}</p>
      </Section>
      
      <CreativeDirectionPanel
          state={creativeState}
          setState={setCreativeState}
          language={language}
          showPose={false}
          numberOfImages={numberOfImages}
          setNumberOfImages={setNumberOfImages}
          aspectRatio={aspectRatio}
          setAspectRatio={setAspectRatio}
      />
      
      <div className="pt-4 mt-auto">
          <div className="flex gap-4">
            <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full mt-2 flex items-center justify-center gap-2 bg-primary-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
                {isLoading ? <Spinner /> : T.generateButton}
            </button>
            <button
                onClick={handleReset}
                disabled={isLoading}
                className="flex-shrink-0 mt-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 font-semibold py-3 px-4 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors disabled:opacity-50"
            >
                {T.resetButton}
            </button>
          </div>
          {error && !isLoading && <p className="text-red-500 dark:text-red-400 mt-2 text-center">{error}</p>}
      </div>
    </>
  );

  const ActionButtons: React.FC<{ imageBase64: string; mimeType: string }> = ({ imageBase64, mimeType }) => (
    <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
      <button onClick={() => onReEdit({ base64: imageBase64, mimeType })} title="Re-edit this image" className="flex items-center justify-center w-8 h-8 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors"><WandIcon className="w-4 h-4" /></button>
      <button onClick={() => onCreateVideo({ prompt: getProductPhotoPrompt({ customPrompt, creativeDirection: creativeState }), image: { base64: imageBase64, mimeType } })} title="Create Video from this image" className="flex items-center justify-center w-8 h-8 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors"><VideoIcon className="w-4 h-4" /></button>
      <button onClick={() => triggerDownload(imageBase64, 'monoklix-product-photo')} title="Download Image" className="flex items-center justify-center w-8 h-8 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors"><DownloadIcon className="w-4 h-4" /></button>
    </div>
  );

  const rightPanel = (
    <>
        {images.length > 0 ? (
           <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-2">
            <div className="flex-1 flex items-center justify-center min-h-0 w-full relative group">
                {(() => {
                    const selectedImage = images[selectedImageIndex];
                    if (typeof selectedImage === 'string') {
                        return (
                            <>
                                <img src={`data:image/png;base64,${selectedImage}`} alt={`Generated image ${selectedImageIndex + 1}`} className="rounded-md max-h-full max-w-full object-contain" />
                                <ActionButtons imageBase64={selectedImage} mimeType="image/png" />
                            </>
                        );
                    } else if (selectedImage && typeof selectedImage === 'object') {
                        return (
                            <div className="text-center text-red-500 dark:text-red-400 p-4">
                                <AlertTriangleIcon className="w-12 h-12 mx-auto mb-4" />
                                <p className="font-semibold">Generation Failed - Try Again @ Check Console Log.</p>
                                <p className="text-sm mt-2 max-w-md mx-auto text-neutral-500 dark:text-neutral-400">All attempts failed. Please try again.</p>
                                <button
                                    onClick={() => handleRetry(selectedImageIndex)}
                                    className="mt-6 flex items-center justify-center gap-2 bg-primary-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-primary-700 transition-colors"
                                >
                                    <RefreshCwIcon className="w-4 h-4" />
                                    Try Again
                                </button>
                            </div>
                        );
                    }
                    return (
                        <div className="flex flex-col items-center justify-center h-full gap-2">
                            <Spinner />
                            {isLoading && numberOfImages > 1 && (
                                <p className="text-sm text-neutral-500">
                                    {`Completed: ${progress} / ${numberOfImages}`}
                                </p>
                            )}
                        </div>
                    );
                })()}
            </div>
            {images.length > 1 && (
              <div className="flex-shrink-0 w-full flex justify-center">
                <div className="flex gap-2 overflow-x-auto p-2">
                  {images.map((img, index) => (
                    <button key={index} onClick={() => setSelectedImageIndex(index)} className={`w-16 h-16 md:w-20 md:h-20 rounded-md overflow-hidden flex-shrink-0 transition-all duration-200 flex items-center justify-center bg-neutral-200 dark:bg-neutral-800 ${selectedImageIndex === index ? 'ring-4 ring-primary-500' : 'ring-2 ring-transparent hover:ring-primary-300'}`}>
                       {typeof img === 'string' ? (
                            <img src={`data:image/png;base64,${img}`} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
                        ) : img && typeof img === 'object' ? (
                            <AlertTriangleIcon className="w-6 h-6 text-red-500" />
                        ) : (
                            <div className="flex flex-col items-center justify-center">
                                <Spinner />
                                <span className="text-[10px] mt-1 text-neutral-500">Slot {index + 1}</span>
                            </div>
                        )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
                <Spinner />
                <p className="text-sm text-neutral-500">
                    {`${commonT.generating}${numberOfImages > 1 ? ` (1/${numberOfImages})` : ''}`}
                </p>
                {isLoading && numberOfImages > 1 && <p className="text-xs text-neutral-400">Completed: {progress} / {numberOfImages}</p>}
            </div>
        ) : (
          <div className="text-center text-neutral-500 dark:text-neutral-600">
            <CameraIcon className="w-16 h-16 mx-auto" /><p>{T.outputPlaceholder}</p>
          </div>
        )}
    </>
  );
  
  return <TwoColumnLayout leftPanel={leftPanel} rightPanel={rightPanel} language={language} />;
};

export default ProductPhotoView;
