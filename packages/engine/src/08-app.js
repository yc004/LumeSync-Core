// ========================================================
// LumeSync render-engine runtime API
// Core owns course loading and course-stage rendering only.
// Host applications own teacher/student chrome and app flow.
// ========================================================

const ensurePdfJsLoaded = async () => {
    if (window.pdfjsLib && typeof window.pdfjsLib.getDocument === 'function') return true;
    const ok = await loadScriptWithFallback(
        '/lib/pdf.min.js',
        'https://fastly.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js'
    );
    if (!ok || !window.pdfjsLib) return false;
    try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/lib/pdf.worker.min.js';
    } catch (_) {}
    return true;
};

const getPdfDoc = (pdfUrl) => {
    if (!window.__LumeSyncPdfDocCache) window.__LumeSyncPdfDocCache = new Map();
    const cache = window.__LumeSyncPdfDocCache;
    const key = String(pdfUrl || '');
    if (!key) return Promise.reject(new Error('Missing pdfUrl'));
    const existing = cache.get(key);
    if (existing) return existing;
    const p = window.pdfjsLib.getDocument({ url: key }).promise;
    cache.set(key, p);
    return p;
};

function PdfPageSlide({ pdfUrl, pageNumber }) {
    const canvasRef = useRef(null);
    const [status, setStatus] = useState('loading');

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                setStatus('loading');
                const doc = await getPdfDoc(pdfUrl);
                const page = await doc.getPage(pageNumber);
                if (cancelled) return;

                const canvas = canvasRef.current;
                if (!canvas) return;

                const ctx = canvas.getContext('2d', { alpha: false });
                if (!ctx) throw new Error('Canvas context not available');

                const padding = 24;
                const maxW = 1280 - padding * 2;
                const maxH = 720 - padding * 2;

                const baseViewport = page.getViewport({ scale: 1 });
                const scale = Math.max(0.1, Math.min(maxW / baseViewport.width, maxH / baseViewport.height));
                const viewport = page.getViewport({ scale });

                const outputScale = window.devicePixelRatio || 1;
                canvas.width = Math.max(1, Math.floor(viewport.width * outputScale));
                canvas.height = Math.max(1, Math.floor(viewport.height * outputScale));
                canvas.style.width = Math.floor(viewport.width) + 'px';
                canvas.style.height = Math.floor(viewport.height) + 'px';

                ctx.setTransform(1, 0, 0, 1, 0, 0);
                if (outputScale !== 1) ctx.scale(outputScale, outputScale);

                await page.render({ canvasContext: ctx, viewport }).promise;
                if (cancelled) return;
                setStatus('done');
            } catch (err) {
                if (cancelled) return;
                console.error('[PDF] render failed:', err);
                setStatus('error');
            }
        })();

        return () => { cancelled = true; };
    }, [pdfUrl, pageNumber]);

    return (
        <div className="w-full h-full bg-slate-50 flex items-center justify-center relative">
            <canvas ref={canvasRef} className="bg-white rounded-xl shadow-xl" />
            {status === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="px-4 py-2 rounded-xl bg-white/90 border border-slate-200 text-slate-600 font-bold">
                        Rendering PDF...
                    </div>
                </div>
            )}
            {status === 'error' && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 font-bold">
                        PDF render failed
                    </div>
                </div>
            )}
            <div className="absolute bottom-4 right-4 px-2 py-1 rounded-lg bg-white/90 border border-slate-200 text-slate-600 text-xs font-bold">
                {pageNumber}
            </div>
        </div>
    );
}

const setProgress = (onProgress, patch) => {
    if (typeof onProgress === 'function') onProgress(patch);
};

const createCourseContext = ({ socket, modelUrl, onCameraActive } = {}) => ({
    ...(modelUrl ? { modelUrl } : {}),
    canvas: window.__LumeSyncCanvas,
    getCamera: (onStream) => {
        if (typeof onCameraActive === 'function') onCameraActive(true);
        if (window._onCamActive) {
            window._onCamActive(true);
        } else {
            setTimeout(() => {
                if (window._onCamActive) window._onCamActive(true);
            }, 0);
        }
        return window.CameraManager.getStream(onStream);
    },
    releaseCamera: () => window.CameraManager.release(),
    unregisterCamera: (onStream) => window.CameraManager.unregister(onStream),
    syncInteraction: (event, payload = {}) => {
        const activeSocket = socket || window.socketRef?.current;
        if (activeSocket) activeSocket.emit('interaction:sync', { event, payload });
    },
});

const loadCourse = async (course, options = {}) => {
    const { socket, onProgress, createContext = createCourseContext } = options;
    if (!course || !course.file) throw new Error('Missing course file');

    const courseFileLower = String(course.file || '').toLowerCase();
    if (courseFileLower.endsWith('.pdf')) {
        setProgress(onProgress, { currentStep: 'init-pdf', currentFile: 'pdf.js', progress: 10, totalSteps: 3, currentStepIndex: 1 });
        const ok = await ensurePdfJsLoaded();
        if (!ok) throw new Error('PDF renderer failed to load');

        const pdfUrl = '/courses/' + course.file;
        setProgress(onProgress, { currentStep: 'parse-pdf', currentFile: course.file, progress: 50, totalSteps: 3, currentStepIndex: 2 });
        const doc = await getPdfDoc(pdfUrl);
        const pageCount = Math.max(1, Number(doc.numPages || 1));
        const slides = Array.from({ length: pageCount }, (_, idx) => ({
            id: 'page-' + (idx + 1),
            component: <PdfPageSlide pdfUrl={pdfUrl} pageNumber={idx + 1} />
        }));

        window.CourseGlobalContext = createContext({ socket });
        setProgress(onProgress, { currentStep: 'done', currentFile: '', progress: 100, totalSteps: 3, currentStepIndex: 3 });
        return {
            id: course.id,
            title: course.title || course.id,
            icon: course.icon || 'PDF',
            desc: course.desc || 'PDF courseware',
            color: course.color || 'from-rose-500 to-orange-600',
            slides
        };
    }

    window.CourseData = null;
    setProgress(onProgress, { currentStep: 'fetch-course', currentFile: course.file, progress: 5, totalSteps: 3, currentStepIndex: 1 });

    const scriptUrl = '/courses/' + course.file;
    const response = await fetch(scriptUrl);
    if (!response.ok) throw new Error('Failed to fetch ' + scriptUrl);
    const scriptContent = await response.text();

    setProgress(onProgress, { currentStep: 'compile-course', currentFile: course.file, progress: 15, totalSteps: 3, currentStepIndex: 2 });
    let compiledCode = scriptContent;
    if (window.Babel) {
        const babelFilename = String(course.file || '').toLowerCase().endsWith('.lume')
            ? String(course.file).replace(/\.lume$/i, '.tsx')
            : course.file;
        compiledCode = window.Babel.transform(scriptContent, { presets: ['react', 'typescript'], filename: babelFilename }).code;
    }

    setProgress(onProgress, { currentStep: 'execute-course', currentFile: course.file, progress: 25, totalSteps: 3, currentStepIndex: 3 });
    new Function(compiledCode)();

    let retries = 100;
    while (!window.CourseData && retries > 0) {
        await new Promise(r => setTimeout(r, 100));
        retries--;
    }
    if (!window.CourseData) throw new Error('CourseData was not registered by ' + course.file);

    let totalSteps = 3;
    const dependencies = Array.isArray(window.CourseData.dependencies) ? window.CourseData.dependencies : [];
    if (dependencies.length) totalSteps += dependencies.length;
    if (window.CourseData.modelsUrls) totalSteps += 1;

    if (dependencies.length) {
        const depMappings = dependencies
            .filter(d => d.localSrc && d.publicSrc)
            .map(d => ({ filename: d.localSrc.split('/').pop(), publicSrc: d.publicSrc }));
        if (depMappings.length > 0 && socket) socket.emit('register-dependencies', depMappings);

        let depIndex = 0;
        for (const dep of dependencies) {
            const fileName = dep.localSrc.split('/').pop();
            setProgress(onProgress, {
                currentStep: 'load-dependency',
                currentFile: fileName,
                progress: 30 + (depIndex / Math.max(dependencies.length, 1)) * 40,
                totalSteps,
                currentStepIndex: 4 + depIndex
            });
            await loadScriptWithFallback(dep.localSrc, dep.publicSrc);
            depIndex++;
        }
    }

    let modelUrl = '';
    if (window.CourseData.modelsUrls) {
        setProgress(onProgress, { currentStep: 'check-models', currentFile: 'models', progress: 75, totalSteps, currentStepIndex: 4 + dependencies.length });
        modelUrl = await checkModelUrlValidity(window.CourseData.modelsUrls);
    }

    window.CourseGlobalContext = createContext({ socket, modelUrl });
    setProgress(onProgress, { currentStep: 'done', currentFile: '', progress: 100, totalSteps, currentStepIndex: totalSteps });
    return window.CourseData;
};

function CourseStage(props) {
    const {
        renderChrome = false,
        renderTeacherOverlays = false,
        hideTopBar = true,
        hideBottomBar = true,
        ...stageProps
    } = props;
    return (
        <SyncClassroom
            {...stageProps}
            renderChrome={renderChrome}
            renderTeacherOverlays={renderTeacherOverlays}
            hideTopBar={hideTopBar}
            hideBottomBar={hideBottomBar}
        />
    );
}

const renderCourseStage = (rootElement, props) => {
    if (!rootElement) throw new Error('Missing rootElement');
    const root = ReactDOM.createRoot(rootElement);
    root.render(<CourseStage {...props} />);
    return root;
};

window.LumeSyncRenderEngine = {
    ...(window.LumeSyncRenderEngine || {}),
    CourseErrorBoundary,
    CourseStage,
    PdfPageSlide,
    WebPageSlide,
    createCourseContext,
    getPdfDoc,
    loadCourse,
    renderCourseStage,
};

console.log('[LumeSync RenderEngine] runtime API loaded');
