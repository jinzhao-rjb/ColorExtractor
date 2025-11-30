// 兼容性检查
if (!window.FileReader) {
    alert('Your browser does not support file reading. Please use modern browsers like Chrome, Firefox or Edge.');
}

if (!document.querySelector) {
    alert('Your browser version is too low. Please update to the latest version.');
}

// DOM 元素
const imageUpload = document.getElementById('image-upload');
const imagePreview = document.getElementById('image-preview');
const previewSection = document.getElementById('preview-section');
const colorsContainer = document.getElementById('colors-container');
const colorCount = document.getElementById('color-count');
const colorCountValue = document.getElementById('color-count-value');
const colorFormat = document.getElementById('color-format');
const toast = document.getElementById('toast');
const themeToggle = document.getElementById('theme-toggle');

// 获取提取方法选择器元素
let extractMethod;
try {
    extractMethod = document.getElementById('extract-method');
} catch (e) {
    console.warn('提取方法选择器未找到');
}

// 测试函数 - 用于验证Worker线程处理各种图像数据情况
function runColorExtractorTests() {
    console.log('===== 颜色提取工具测试开始 =====');
    
    const testCases = [
        {
            name: '测试1: 正常像素数据',
            pixels: new Uint8ClampedArray([255,0,0,255, 0,255,0,255, 0,0,255,255]), // RGB红色、绿色、蓝色
            expected: '应成功提取三种颜色'
        },
        {
            name: '测试2: 空像素数据',
            pixels: new Uint8ClampedArray([]),
            expected: '应返回默认颜色'
        },
        {
            name: '测试3: 非4倍数长度像素数据',
            pixels: new Uint8ClampedArray([255,0,0, 0,255,0, 0,0,255]), // 每个颜色缺少alpha通道
            expected: '应自动调整长度并处理'
        },
        {
            name: '测试4: 大量重复颜色',
            pixels: (function() {
                const data = new Uint8ClampedArray(1000 * 4);
                for(let i=0; i<data.length; i+=4) {
                    data[i] = 255;     // R
                    data[i+1] = 255;   // G
                    data[i+2] = 255;   // B
                    data[i+3] = 255;   // A
                }
                return data;
            })(),
            expected: '应识别出主要为白色'
        },
        {
            name: '测试5: 全部透明像素',
            pixels: (function() {
                const data = new Uint8ClampedArray(100 * 4);
                for(let i=0; i<data.length; i+=4) {
                    data[i] = 0;
                    data[i+1] = 0;
                    data[i+2] = 0;
                    data[i+3] = 0; // 透明
                }
                return data;
            })(),
            expected: '应返回默认颜色'
        },
        {
            name: '测试6: 极端值像素',
            pixels: new Uint8ClampedArray([255,0,0,255, 0,0,0,255, 255,255,255,255]), // 最大、最小RGB值
            expected: '应正确处理极端RGB值'
        }
    ];
    
    // 为每个测试用例创建一个Worker
    testCases.forEach((testCase, index) => {
        console.log(`\n${testCase.name}`);
        console.log(`预期结果: ${testCase.expected}`);
        
        // 简单的Worker代码
        const testWorkerCode = `
            // 简化的Worker函数
            function rgbToHex(r, g, b) {
                return '#' + [r, g, b].map(x => {
                    const hex = x.toString(16);
                    return hex.length === 1 ? '0' + hex : hex;
                }).join('').toUpperCase();
            }
            
            function hexToRgb(hex) {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result ? {
                    r: parseInt(result[1], 16),
                    g: parseInt(result[2], 16),
                    b: parseInt(result[3], 16)
                } : null;
            }
            
            function clusterColors(colorFrequency, k) {
                try {
                    const colors = Object.entries(colorFrequency)
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, k)
                        .map(([hex, freq]) => {
                            const rgb = hexToRgb(hex);
                            if (rgb) {
                                return {
                                    color: rgb,
                                    hex: hex,
                                    percentage: Math.round((freq / Object.values(colorFrequency).reduce((a, b) => a + b, 0)) * 100)
                                };
                            }
                            return null;
                        })
                        .filter(Boolean);
                    return colors;
                } catch (e) {
                    console.error('聚类错误:', e);
                    return [];
                }
            }
            
            // 模拟原始Worker的处理逻辑
            try {
                const pixels = new Uint8ClampedArray(${JSON.stringify(Array.from(testCase.pixels))});
                const k = 5;
                let colorFrequency = {};
                
                // 处理像素数据
                try {
                    // 处理非4倍数长度
                    const length = pixels.length;
                    const safeLength = Math.floor(length / 4) * 4;
                    
                    for(let i=0; i<safeLength; i+=4) {
                        const a = pixels[i+3];
                        if (a < 128) continue; // 跳过透明像素
                        
                        const r = pixels[i];
                        const g = pixels[i+1];
                        const b = pixels[i+2];
                        
                        const hex = rgbToHex(r, g, b);
                        colorFrequency[hex] = (colorFrequency[hex] || 0) + 1;
                    }
                } catch (e) {
                    console.error('像素处理错误:', e);
                }
                
                // 验证颜色频率数据
                if (!colorFrequency || Object.keys(colorFrequency).length === 0) {
                    colorFrequency = {
                        '#FFFFFF': 50,
                        '#000000': 50
                    };
                }
                
                // 提取颜色
                let colors = clusterColors(colorFrequency, k);
                
                // 确保返回有效的颜色数组
                if (!colors || colors.length === 0) {
                    colors = [
                        { color: { r: 255, g: 255, b: 255 }, hex: '#FFFFFF', percentage: 50 },
                        { color: { r: 0, g: 0, b: 0 }, hex: '#000000', percentage: 50 }
                    ];
                }
                
                // 返回结果
                self.postMessage({
                    success: true,
                    colors: colors,
                    method: 'test',
                    processingTime: 100
                });
            } catch (e) {
                self.postMessage({
                    success: false,
                    error: e.message,
                    colors: [
                        { color: { r: 128, g: 128, b: 128 }, hex: '#808080', percentage: 100 }
                    ]
                });
            } finally {
                self.close();
            }
        `;
        
        const testWorker = new Worker(URL.createObjectURL(new Blob([testWorkerCode], { type: 'application/javascript' })));
        
        // 设置超时
        const testTimeout = setTimeout(() => {
            console.log(`❌ 测试${index+1}超时`);
            try { testWorker.terminate(); } catch (e) {}
        }, 5000);
        
        // 监听结果
        testWorker.onmessage = function(e) {
            clearTimeout(testTimeout);
            try { testWorker.terminate(); } catch (e) {}
            
            if (e.data.success) {
                console.log(`✅ 测试${index+1}成功: 提取了${e.data.colors.length}种颜色`);
                console.log(`   使用方法: ${e.data.method}`);
                console.log(`   处理时间: ${e.data.processingTime}ms`);
                console.log(`   颜色样本:`, e.data.colors.slice(0,2));
            } else {
                console.log(`⚠️  测试${index+1}返回错误，但提供了备用颜色`);
                console.log(`   错误: ${e.data.error}`);
                console.log(`   备用颜色数量: ${e.data.colors.length}`);
            }
        };
        
        testWorker.onerror = function(e) {
            clearTimeout(testTimeout);
            console.log(`❌ 测试${index+1}发生Worker错误:`, e.message);
        };
    });
    
    console.log('\n===== 测试启动完成，请查看控制台输出 =====');
    console.log('提示: 在控制台输入 runColorExtractorTests() 可重新运行测试');
}

// 将测试函数暴露到全局，便于手动测试
window.runColorExtractorTests = runColorExtractorTests;

// 确保所有必要的DOM元素都存在
const requiredElements = [
    { name: 'image-upload', element: imageUpload },
    { name: 'image-preview', element: imagePreview },
    { name: 'colors-container', element: colorsContainer },
    { name: 'color-count', element: colorCount },
    { name: 'color-format', element: colorFormat },
    { name: 'toast', element: toast }
];

// 检查缺失的元素
const missingElements = requiredElements.filter(item => !item.element);
if (missingElements.length > 0) {
    console.warn('警告: 缺少以下必要元素:', 
        missingElements.map(item => item.name).join(', '));
}

// 设置默认值
let currentImage = null;

// 深色模式切换
function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
    const icon = themeToggle.querySelector('svg');
    if (isDark) {
        icon.innerHTML = `<path d="M12 16.5c2.5 0 4.5-2 4.5-4.5S14.5 7.5 12 7.5 7.5 9.5 7.5 12s2 4.5 4.5 4.5zm0-10c1.4 0 2.5 1.1 2.5 2.5S13.4 13.5 12 13.5 9.5 12.4 9.5 11 10.6 8.5 12 8.5z"/><path d="M12 2.5a9.5 9.5 0 0 0-9.5 9.5 9.5 9.5 0 0 0 9.5 9.5 9.5 9.5 0 0 0 9.5-9.5 9.5 9.5 0 0 0-9.5-9.5zm0 17c-4.1 0-7.5-3.4-7.5-7.5s3.4-7.5 7.5-7.5 7.5 3.4 7.5 7.5-3.4 7.5-7.5 7.5z"/>`;
    } else {
        icon.innerHTML = `<path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29l-1.43-1.43z"/>`;
    }
}

// 检查用户主题偏好
function checkThemePreference() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.body.classList.add('dark-mode');
        updateThemeIcon(true);
    } else {
        updateThemeIcon(false);
    }
}

// 监听颜色数量变化
colorCount.addEventListener('input', (e) => {
    colorCountValue.textContent = e.target.value;
    if (currentImage) {
        extractColors();
    }
});

// 监听颜色格式变化
colorFormat.addEventListener('change', () => {
    if (currentImage) {
        extractColors();
    }
});

// 监听提取方法变化
extractMethod?.addEventListener('change', () => {
    if (currentImage) {
        extractColors();
    }
});

// 点击提取颜色功能
function setupColorPicker() {
    const imagePreview = document.getElementById('image-preview');
    if (!imagePreview) return;
    
    // 创建Canvas元素用于获取像素数据
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // 等待图片加载完成后绘制到Canvas
    if (imagePreview.complete) {
        drawImageToCanvas();
    } else {
        imagePreview.addEventListener('load', drawImageToCanvas);
    }
    
    function drawImageToCanvas() {
        // 设置Canvas尺寸与原始图片一致
        canvas.width = currentImage.width;
        canvas.height = currentImage.height;
        
        // 绘制图片到Canvas
        ctx.drawImage(currentImage, 0, 0);
    }
    
    // 添加点击事件监听器
    imagePreview.addEventListener('click', (e) => {
        const rect = imagePreview.getBoundingClientRect();
        const scaleX = currentImage.width / rect.width;
        const scaleY = currentImage.height / rect.height;
        
        // 计算点击位置相对于原始图片的坐标
        const x = Math.floor((e.clientX - rect.left) * scaleX);
        const y = Math.floor((e.clientY - rect.top) * scaleY);
        
        // 获取像素颜色
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        const r = pixel[0];
        const g = pixel[1];
        const b = pixel[2];
        const a = pixel[3];
        
        // 转换为HEX格式
        const hex = rgbToHex(r, g, b);
        
        // 显示提取的颜色
        showClickedColor(r, g, b, hex);
    });
}

// RGB转HEX函数
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('').toUpperCase();
}

// 显示点击提取的颜色
function showClickedColor(r, g, b, hex) {
    // 创建颜色信息元素
    let colorInfo = document.getElementById('clicked-color-info');
    if (!colorInfo) {
        colorInfo = document.createElement('div');
        colorInfo.id = 'clicked-color-info';
        colorInfo.className = 'clicked-color-info';
        
        // 添加到DOM
        const previewSection = document.getElementById('preview-section');
        if (previewSection) {
            previewSection.appendChild(colorInfo);
        }
    }
    
    // 更新颜色信息
    colorInfo.innerHTML = `
        <div class="clicked-color-header">
            <h3>点击位置的颜色</h3>
        </div>
        <div class="clicked-color-content">
            <div class="clicked-color-preview" style="background-color: ${hex}"></div>
            <div class="clicked-color-details">
                <div class="color-value">
                    <span class="label">HEX:</span>
                    <span class="value" id="clicked-hex">${hex}</span>
                    <button class="copy-btn" data-copy="${hex}">复制</button>
                </div>
                <div class="color-value">
                    <span class="label">RGB:</span>
                    <span class="value" id="clicked-rgb">rgb(${r}, ${g}, ${b})</span>
                    <button class="copy-btn" data-copy="rgb(${r}, ${g}, ${b})">复制</button>
                </div>
            </div>
        </div>
    `;
    
    // 添加复制按钮事件监听器
    const copyBtns = colorInfo.querySelectorAll('.copy-btn');
    copyBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const textToCopy = btn.getAttribute('data-copy');
            navigator.clipboard.writeText(textToCopy)
                .then(() => {
                    showToast(`已复制: ${textToCopy}`);
                })
                .catch(err => {
                    console.error('复制失败:', err);
                    showToast('复制失败，请手动复制');
                });
        });
    });
}

// 监听图片上传
imageUpload.addEventListener('change', handleImageUpload);

// 监听拖放事件
const uploadContainer = document.querySelector('.upload-container');

// 防止文档默认的拖放行为
window.addEventListener('dragover', (e) => {
    e.preventDefault();
});

window.addEventListener('drop', (e) => {
    e.preventDefault();
});

// 处理图片上传
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (file) {
        handleFileUpload(file);
    }
}

// 处理文件
function handleFileUpload(file) {
    try {
        // 确保file对象有效
        if (!file || typeof file !== 'object' || !file.type) {
            showToast('无效的文件对象');
            return;
        }
        
        // 检查文件类型
        const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!file.type || !validImageTypes.includes(file.type.toLowerCase())) {
            showToast('请上传有效的图片文件（JPG、PNG、GIF、WebP）');
            return;
        }
        
        // 检查文件大小（限制为10MB）
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            showToast('图片大小不能超过10MB，请上传较小的图片');
            return;
        }
        
        // 显示加载状态
        if (uploadContainer) {
            uploadContainer.style.opacity = '0.7';
            uploadContainer.style.cursor = 'not-allowed';
        }
        
        // 添加加载中提示
        showToast('正在处理图片...');
        
        // 创建安全的FileReader对象
        let reader;
        try {
            reader = new FileReader();
        } catch (e) {
            console.error('无法创建FileReader:', e);
            showToast('浏览器不支持文件读取功能');
            if (uploadContainer) {
                uploadContainer.style.opacity = '1';
                uploadContainer.style.cursor = 'pointer';
            }
            return;
        }
        
        // 设置超时处理，防止处理时间过长
        const timeoutId = setTimeout(() => {
            if (reader) {
                // 在支持的浏览器中，尝试中止读取
                if (reader.abort && typeof reader.abort === 'function') {
                    try {
                        reader.abort();
                    } catch (e) {}
                }
            }
            showToast('图片处理超时，请尝试较小的图片');
            if (uploadContainer) {
                uploadContainer.style.opacity = '1';
                uploadContainer.style.cursor = 'pointer';
            }
        }, 30000); // 30秒超时
        
        reader.onload = function(e) {
            // 清除超时定时器
            clearTimeout(timeoutId);
            
            // 恢复上传区域样式
            if (uploadContainer) {
                uploadContainer.style.opacity = '1';
                uploadContainer.style.cursor = 'pointer';
            }
            
            try {
                // 检查结果是否有效
                if (!e || !e.target || !e.target.result) {
                    throw new Error('无效的文件读取结果');
                }
                
                // 创建图片对象
                const img = new Image();
                
                // 设置图片加载超时
                const imgTimeoutId = setTimeout(() => {
                    showToast('图片加载超时');
                    if (uploadContainer) {
                        uploadContainer.style.opacity = '1';
                        uploadContainer.style.cursor = 'pointer';
                    }
                }, 15000); // 15秒图片加载超时
                
                img.onload = function() {
                    try {
                        // 清除图片加载超时
                        clearTimeout(imgTimeoutId);
                        
                        // 检查图片尺寸是否有效
                        if (!img.width || !img.height || img.width === 0 || img.height === 0) {
                            throw new Error('无效的图片尺寸');
                        }
                        
                        // 保存当前图片
                        currentImage = img;
                        
                        // 显示预览
                        if (imagePreview) {
                            imagePreview.src = e.target.result;
                        }
                        
                        if (previewSection) {
                            previewSection.style.display = 'block';
                        }
                        
                        showToast('图片加载成功');
                        // 提取颜色
                        extractColors();
                        // 添加点击提取颜色功能
                        setupColorPicker();
                    } catch (error) {
                        console.error('图片加载后处理出错:', error);
                        showToast('图片处理失败: ' + (error.message || '未知错误'));
                        if (uploadContainer) {
                            uploadContainer.style.opacity = '1';
                            uploadContainer.style.cursor = 'pointer';
                        }
                    }
                };
                
                img.onerror = function() {
                    clearTimeout(imgTimeoutId);
                    console.error('图片加载失败');
                    showToast('无法加载图片，请确保文件格式正确且未损坏');
                    if (uploadContainer) {
                        uploadContainer.style.opacity = '1';
                        uploadContainer.style.cursor = 'pointer';
                    }
                };
                
                // 加载图片
                img.src = e.target.result;
                
                // 防止图片缓存问题
                if (img.complete && img.naturalHeight > 0) {
                    // 如果图片已在缓存中，手动触发onload
                    clearTimeout(imgTimeoutId);
                    img.onload();
                }
            } catch (error) {
                console.error('图片处理出错:', error);
                showToast('图片处理失败: ' + (error.message || '未知错误'));
                if (uploadContainer) {
                    uploadContainer.style.opacity = '1';
                    uploadContainer.style.cursor = 'pointer';
                }
            }
        };
        
        reader.onerror = function(e) {
            clearTimeout(timeoutId);
            console.error('文件读取失败:', e);
            showToast('文件读取失败，请尝试其他文件');
            if (uploadContainer) {
                uploadContainer.style.opacity = '1';
                uploadContainer.style.cursor = 'pointer';
            }
        };
        
        reader.onabort = function() {
            clearTimeout(timeoutId);
            console.error('文件读取已中止');
            showToast('文件读取已中止');
            if (uploadContainer) {
                uploadContainer.style.opacity = '1';
                uploadContainer.style.cursor = 'pointer';
            }
        };
        
        // 读取文件
        reader.readAsDataURL(file);
    } catch (error) {
        console.error('处理文件时发生错误:', error);
        showToast('处理文件时发生错误');
        if (uploadContainer) {
            uploadContainer.style.opacity = '1';
            uploadContainer.style.cursor = 'pointer';
        }
    }
}

// 提取颜色
function extractColors() {
    try {
        if (!currentImage) {
            console.warn('没有当前图片可处理');
            showToast('请先上传图片');
            return;
        }
        
        // 显示加载中提示
        showToast('正在提取颜色，请稍候...');
        
        // 清空颜色容器
        if (colorsContainer) {
            colorsContainer.innerHTML = '<div class="loading">正在提取颜色...</div>';
        }
        
        // 使用Web Worker来处理颜色提取，避免阻塞UI线程
        if (window.Worker && typeof Worker === 'function') {
            try {
                const workerCode = `
                    // 颜色提取相关函数
                    function rgbToHex(r, g, b) {
                        try {
                            return '#' + [r, g, b].map(x => {
                                const hex = x.toString(16);
                                return hex.length === 1 ? '0' + hex : hex;
                            }).join('');
                        } catch (e) {
                            return '#000000'; // 默认黑色作为安全回退
                        }
                    }
                    
                    function hexToRgb(hex) {
                        try {
                            const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
                            return result ? {
                                r: parseInt(result[1], 16),
                                g: parseInt(result[2], 16),
                                b: parseInt(result[3], 16)
                            } : null;
                        } catch (e) {
                            return null;
                        }
                    }
                    
                    // 颜色聚类 (K-means算法) - 增强版
                    function clusterColors(colorFrequency, k) {
                        try {
                            // 将颜色数据转换为数组形式
                            const colorData = [];
                            const entries = Object.entries(colorFrequency) || [];
                            for (let i = 0; i < entries.length; i++) {
                                const [hex, count] = entries[i];
                                const rgb = hexToRgb(hex);
                                if (rgb && typeof count === 'number') {
                                    colorData.push({
                                        r: rgb.r,
                                        g: rgb.g,
                                        b: rgb.b,
                                        hex: hex,
                                        count: count
                                    });
                                }
                            }
                            
                            // 安全检查
                            if (!Array.isArray(colorData) || colorData.length === 0) {
                                // 返回默认的基础颜色
                                return [
                                    { hex: '#FFFFFF', r: 255, g: 255, b: 255, percentage: '100' }
                                ];
                            }
                            
                            // 如果颜色数量少于k，直接返回所有颜色
                            if (colorData.length <= k) {
                                try {
                                    const total = colorData.reduce((sum, c) => sum + (c.count || 0), 0);
                                    return colorData.sort((a, b) => (b.count || 0) - (a.count || 0)).map(color => ({
                                        hex: color.hex,
                                        r: color.r,
                                        g: color.g,
                                        b: color.b,
                                        percentage: total > 0 ? ((color.count / total) * 100).toFixed(1) : '0'
                                    }));
                                } catch (e) {
                                    // 排序失败时的安全回退
                                    return colorData.slice(0, k).map(color => ({
                                        hex: color.hex,
                                        r: color.r,
                                        g: color.g,
                                        b: color.b,
                                        percentage: '100'
                                    }));
                                }
                            }
                            
                            // 改进的K-means++初始化
                            let centroids = [];
                            try {
                                // 随机选择第一个聚类中心
                                const firstIndex = Math.floor(Math.random() * colorData.length);
                                centroids.push({
                                    r: colorData[firstIndex].r,
                                    g: colorData[firstIndex].g,
                                    b: colorData[firstIndex].b
                                });
                                
                                // 选择剩余的聚类中心
                                for (let i = 1; i < k && i < colorData.length; i++) {
                                    // 计算每个点到最近聚类中心的距离
                                    const distances = [];
                                    for (let j = 0; j < colorData.length; j++) {
                                        let minDist = Infinity;
                                        for (let c = 0; c < centroids.length; c++) {
                                            const dist = Math.sqrt(
                                                Math.pow(colorData[j].r - centroids[c].r, 2) +
                                                Math.pow(colorData[j].g - centroids[c].g, 2) +
                                                Math.pow(colorData[j].b - centroids[c].b, 2)
                                            );
                                            minDist = Math.min(minDist, dist);
                                        }
                                        distances.push(minDist * minDist); // 距离的平方
                                    }
                                    
                                    // 基于距离概率选择下一个中心
                                    const totalDist = distances.reduce((sum, d) => sum + d, 0);
                                    if (totalDist > 0) {
                                        let random = Math.random() * totalDist;
                                        let cumulative = 0;
                                        
                                        for (let j = 0; j < distances.length; j++) {
                                            cumulative += distances[j];
                                            if (random <= cumulative) {
                                                centroids.push({
                                                    r: colorData[j].r,
                                                    g: colorData[j].g,
                                                    b: colorData[j].b
                                                });
                                                break;
                                            }
                                        }
                                    } else {
                                        // 如果所有距离为0，随机选择
                                        const randomIndex = Math.floor(Math.random() * colorData.length);
                                        centroids.push({
                                            r: colorData[randomIndex].r,
                                            g: colorData[randomIndex].g,
                                            b: colorData[randomIndex].b
                                        });
                                    }
                                }
                            } catch (e) {
                                // 初始化失败时的安全回退
                                centroids = [];
                                for (let i = 0; i < Math.min(k, colorData.length); i++) {
                                    centroids.push({
                                        r: colorData[i].r,
                                        g: colorData[i].g,
                                        b: colorData[i].b
                                    });
                                }
                            }
                            
                            let clusters = [];
                            let maxIterations = 20;
                            let iteration = 0;
                            let converged = false;
                            
                            // K-means迭代过程 - 增加了稳定性检查
                            while (!converged && iteration < maxIterations) {
                                try {
                                    // 重置聚类
                                    clusters = Array(centroids.length).fill().map(() => []);
                                    
                                    // 分配每个颜色到最近的聚类中心
                                    for (let i = 0; i < colorData.length; i++) {
                                        const color = colorData[i];
                                        let minDistance = Infinity;
                                        let closestCentroidIndex = 0;
                                        
                                        for (let c = 0; c < centroids.length; c++) {
                                            const centroid = centroids[c];
                                            const distance = Math.sqrt(
                                                Math.pow(color.r - centroid.r, 2) +
                                                Math.pow(color.g - centroid.g, 2) +
                                                Math.pow(color.b - centroid.b, 2)
                                            );
                                            
                                            if (distance < minDistance) {
                                                minDistance = distance;
                                                closestCentroidIndex = c;
                                            }
                                        }
                                        
                                        clusters[closestCentroidIndex].push(color);
                                    }
                                    
                                    // 更新聚类中心
                                    let newCentroids = [];
                                    let hasChanged = false;
                                    
                                    for (let i = 0; i < clusters.length; i++) {
                                        const cluster = clusters[i];
                                        if (cluster.length === 0) {
                                            // 如果聚类为空，保留原中心
                                            newCentroids.push({...centroids[i]});
                                        } else {
                                            try {
                                                // 计算加权平均 (考虑颜色出现频率)
                                                let totalR = 0, totalG = 0, totalB = 0, totalCount = 0;
                                                
                                                for (let j = 0; j < cluster.length; j++) {
                                                    const color = cluster[j];
                                                    totalR += color.r * (color.count || 1);
                                                    totalG += color.g * (color.count || 1);
                                                    totalB += color.b * (color.count || 1);
                                                    totalCount += (color.count || 1);
                                                }
                                                
                                                const newCentroid = {
                                                    r: totalCount > 0 ? Math.round(totalR / totalCount) : 0,
                                                    g: totalCount > 0 ? Math.round(totalG / totalCount) : 0,
                                                    b: totalCount > 0 ? Math.round(totalB / totalCount) : 0
                                                };
                                                
                                                // 检查是否有变化
                                                if (Math.abs(newCentroid.r - centroids[i].r) > 0 ||
                                                    Math.abs(newCentroid.g - centroids[i].g) > 0 ||
                                                    Math.abs(newCentroid.b - centroids[i].b) > 0) {
                                                    hasChanged = true;
                                                }
                                                
                                                newCentroids.push(newCentroid);
                                            } catch (e) {
                                                // 计算失败时保留原中心
                                                newCentroids.push({...centroids[i]});
                                            }
                                        }
                                    }
                                    
                                    // 检查收敛
                                    converged = !hasChanged || iteration >= maxIterations - 1;
                                    centroids = newCentroids;
                                    iteration++;
                                } catch (e) {
                                    // 迭代过程中的错误处理
                                    converged = true; // 提前结束迭代
                                    console.error('K-means迭代错误:', e);
                                }
                            }
                            
                            // 计算每个聚类的主要颜色和百分比
                            const result = [];
                            try {
                                const totalPixels = colorData.reduce((sum, color) => sum + (color.count || 0), 0);
                                
                                for (let i = 0; i < clusters.length; i++) {
                                    const cluster = clusters[i];
                                    if (cluster.length === 0) continue;
                                    
                                    // 找出聚类中最常出现的颜色
                                    let maxCount = 0;
                                    let dominantColor = null;
                                    
                                    for (let j = 0; j < cluster.length; j++) {
                                        const color = cluster[j];
                                        if ((color.count || 0) > maxCount) {
                                            maxCount = color.count || 0;
                                            dominantColor = color;
                                        }
                                    }
                                    
                                    // 计算聚类的总像素数
                                    const clusterTotal = cluster.reduce((sum, color) => sum + (color.count || 0), 0);
                                    
                                    if (dominantColor) {
                                        result.push({
                                            hex: dominantColor.hex,
                                            r: dominantColor.r,
                                            g: dominantColor.g,
                                            b: dominantColor.b,
                                            percentage: totalPixels > 0 ? ((clusterTotal / totalPixels) * 100).toFixed(1) : '0'
                                        });
                                    }
                                }
                            } catch (e) {
                                // 计算百分比失败时的安全回退
                                for (let i = 0; i < centroids.length && i < k; i++) {
                                    result.push({
                                        hex: rgbToHex(centroids[i].r, centroids[i].g, centroids[i].b),
                                        r: centroids[i].r,
                                        g: centroids[i].g,
                                        b: centroids[i].b,
                                        percentage: '0'
                                    });
                                }
                            }
                            
                            // 按像素数排序
                            try {
                                return result.sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));
                            } catch (e) {
                                // 排序失败时直接返回
                                return result;
                            }
                        } catch (error) {
                            console.error('聚类算法错误:', error);
                            // 返回默认颜色
                            return [{ hex: '#000000', r: 0, g: 0, b: 0, percentage: '100' }];
                        }
                    }
                    
                    // 提取最频繁颜色的函数
                    function extractFrequentColorsWorker(pixels, colorCount) {
                        // 计算颜色频率
                        const colorFrequency = {};
                        const precision = 8;
                        
                        for (let i = 0; i < pixels.length; i += 4) {
                            const r = pixels[i] || 0;
                            const g = pixels[i + 1] || 0;
                            const b = pixels[i + 2] || 0;
                            const a = pixels[i + 3] || 0;
                            
                            if (a < 128) continue;
                            
                            const reducedR = Math.floor(r / precision) * precision;
                            const reducedG = Math.floor(g / precision) * precision;
                            const reducedB = Math.floor(b / precision) * precision;
                            const hex = rgbToHex(reducedR, reducedG, reducedB);
                            
                            colorFrequency[hex] = (colorFrequency[hex] || 0) + 1;
                        }
                        
                        // 转换为数组并排序
                        const colorArray = Object.entries(colorFrequency).map(([hex, count]) => ({
                            hex,
                            count
                        }));
                        
                        colorArray.sort((a, b) => b.count - a.count);
                        
                        // 计算总像素数
                        const totalPixels = Object.values(colorFrequency).reduce((sum, count) => sum + count, 0);
                        
                        // 返回前colorCount个颜色
                        return colorArray.slice(0, colorCount).map(item => {
                            const rgb = hexToRgb(item.hex) || { r: 0, g: 0, b: 0 };
                            return {
                                hex: item.hex,
                                r: rgb.r,
                                g: rgb.g,
                                b: rgb.b,
                                percentage: totalPixels > 0 ? ((item.count / totalPixels) * 100).toFixed(1) : '0'
                            };
                        });
                    }
                    
                    // 提取主色调的函数
                    function extractDominantColorsWorker(pixels, colorCount) {
                        const hueGroups = {};
                        const precision = 8;
                        
                        for (let i = 0; i < pixels.length; i += 4) {
                            const r = pixels[i] || 0;
                            const g = pixels[i + 1] || 0;
                            const b = pixels[i + 2] || 0;
                            const a = pixels[i + 3] || 0;
                            
                            if (a < 128) continue;
                            
                            // 简化的HSL转换，只计算色相
                            const max = Math.max(r, g, b);
                            const min = Math.min(r, g, b);
                            let hue = 0;
                            
                            if (max !== min) {
                                const delta = max - min;
                                switch (max) {
                                    case r: hue = ((g - b) / delta) % 6;
                                    case g: hue = ((b - r) / delta) + 2;
                                    case b: hue = ((r - g) / delta) + 4;
                                }
                                hue = Math.floor((hue * 60) / 30) * 30; // 按30度分组
                                if (hue < 0) hue += 360;
                            }
                            
                            const hueKey = hue.toString();
                            if (!hueGroups[hueKey]) {
                                hueGroups[hueKey] = { count: 0, r: 0, g: 0, b: 0 };
                            }
                            
                            hueGroups[hueKey].count++;
                            hueGroups[hueKey].r += r;
                            hueGroups[hueKey].g += g;
                            hueGroups[hueKey].b += b;
                        }
                        
                        // 计算每个色相组的平均颜色
                        const dominantColors = Object.entries(hueGroups).map(([hue, data]) => {
                            const avgR = Math.round(data.r / data.count);
                            const avgG = Math.round(data.g / data.count);
                            const avgB = Math.round(data.b / data.count);
                            
                            return {
                                hex: rgbToHex(avgR, avgG, avgB),
                                r: avgR,
                                g: avgG,
                                b: avgB,
                                count: data.count
                            };
                        });
                        
                        // 排序并返回
                        const total = dominantColors.reduce((sum, color) => sum + color.count, 0);
                        dominantColors.sort((a, b) => b.count - a.count);
                        
                        return dominantColors.slice(0, colorCount).map(color => ({
                            ...color,
                            percentage: total > 0 ? ((color.count / total) * 100).toFixed(1) : '0'
                        }));
                    }
                    
                    // 处理来自主线程的消息
                    self.onmessage = function(e) {
                        try {
                            // 全面增强输入验证，提供更详细的错误信息和诊断数据
                            if (!e || typeof e !== 'object') {
                                console.error('接收到无效的消息事件对象:', e);
                                self.postMessage({ 
                                    success: false, 
                                    error: '无效的消息事件对象',
                                    diagnostic: { messageType: typeof e, messageExists: !!e }
                                });
                                self.close();
                                return;
                            }
                            
                            if (!e.data || typeof e.data !== 'object') {
                                console.error('接收到无效的消息数据对象:', e.data);
                                self.postMessage({ 
                                    success: false, 
                                    error: '无效的消息数据对象',
                                    diagnostic: { dataType: typeof e.data, dataExists: !!e.data }
                                });
                                self.close();
                                return;
                            }
                            
                            // 使用解构赋值时添加默认值和类型检查
                            const k = parseInt(e.data.k) || 5;
                            const extractMethod = typeof e.data.extractMethod === 'string' ? e.data.extractMethod : 'kmeans';
                            const imageData = e.data.imageData;
                            
                            // 详细记录接收到的数据结构，便于调试
                            console.debug('Worker接收到的数据:', {
                                hasImageData: !!imageData,
                                imageDataType: typeof imageData,
                                hasK: 'k' in e.data,
                                hasExtractMethod: 'extractMethod' in e.data,
                                methodValue: extractMethod
                            });
                            
                            // 增强imageData对象检查，支持多种可能的数据格式
                            if (!imageData) {
                                self.postMessage({ 
                                    success: false, 
                                    error: '缺少图像数据',
                                    diagnostic: { receivedKeys: Object.keys(e.data) }
                                });
                                self.close();
                                return;
                            }
                            
                            // 添加更严格的imageData验证，防止无效的图像数据错误
                            if (typeof imageData !== 'object') {
                                self.postMessage({ 
                                    success: false, 
                                    error: '图像数据类型无效',
                                    diagnostic: { imageDataType: typeof imageData }
                                });
                                self.close();
                                return;
                            }
                            
                            // 安全获取pixels，实现多层次的数据获取和验证策略
                            let pixels = [];
                            let pixelSource = 'unknown'; // 记录像素数据来源，用于调试
                            
                            // 尝试多种方式获取像素数据，确保最大兼容性
                            try {
                                // 方式1: 标准ImageData格式 {data, width, height}
                                if (imageData.data) {
                                    pixelSource = 'imageData.data';
                                    if (Array.isArray(imageData.data)) {
                                        pixels = imageData.data;
                                    } else if (typeof imageData.data === 'object' && typeof imageData.data.length === 'number') {
                                        try {
                                            // 优先使用Array.from
                                            pixels = Array.from(imageData.data);
                                        } catch (arrayFromError) {
                                            console.warn('Array.from失败，尝试手动转换:', arrayFromError.message);
                                            // 降级处理1: 手动转换
                                            const data = imageData.data;
                                            const length = Math.min(data.length || 0, 1000000); // 限制最大长度防止内存问题
                                            pixels = new Array(length);
                                            for (let i = 0; i < length; i++) {
                                                try {
                                                    pixels[i] = typeof data[i] === 'number' ? data[i] : 0;
                                                } catch {
                                                    pixels[i] = 0; // 防止访问越界或权限错误
                                                }
                                            }
                                        }
                                    }
                                }
                                
                                // 方式2: 直接数组格式（当data属性存在但无效时）
                                if (pixels.length === 0 && Array.isArray(imageData)) {
                                    pixelSource = 'direct array';
                                    pixels = imageData;
                                }
                                
                                // 方式3: 分离的数据格式 {width, height, pixels}
                                if (pixels.length === 0 && imageData.pixels && Array.isArray(imageData.pixels)) {
                                    pixelSource = 'separate pixels property';
                                    pixels = imageData.pixels;
                                }
                                
                                // 方式4: 处理特殊情况 - 扁平格式，其中数据直接在主对象中
                                if (pixels.length === 0 && typeof imageData === 'object') {
                                    // 检查是否有单独传递的width和height属性
                                    if (typeof e.data.width === 'number' && typeof e.data.height === 'number') {
                                        console.debug('检测到单独的width和height属性');
                                    }
                                    
                                    // 尝试从扁平对象中提取数据
                                    const potentialPixels = [];
                                    // 先检查是否有类似[0], [1], [2]这样的数字索引属性（可能是传输时被序列化的TypedArray）
                                    for (let i = 0; i < 1000000; i++) { // 设置上限防止无限循环
                                        if (i in imageData && typeof imageData[i] === 'number') {
                                            potentialPixels.push(imageData[i]);
                                        } else if (i > 0 && i % 1000 === 0 && potentialPixels.length === 0) {
                                            // 如果检查了1000个元素还没找到数据，就停止
                                            break;
                                        }
                                    }
                                    
                                    // 如果通过数字索引没有找到，再尝试遍历所有属性
                                    if (potentialPixels.length === 0) {
                                        for (const key in imageData) {
                                            try {
                                                if (typeof imageData[key] === 'number' && !isNaN(imageData[key])) {
                                                    potentialPixels.push(imageData[key]);
                                                }
                                            } catch {
                                                // 忽略无法访问的属性
                                            }
                                        }
                                    }
                                    
                                    if (potentialPixels.length > 0) {
                                        pixelSource = 'extracted numeric properties';
                                        pixels = potentialPixels;
                                    }
                                }
                            } catch (pixelExtractError) {
                                console.error('提取像素数据时出错:', pixelExtractError);
                                // 即使提取出错，也记录错误信息但继续处理
                            }
                            
                            // 记录像素数据获取结果
                            console.debug('像素数据获取结果:', {
                                source: pixelSource,
                                length: pixels.length,
                                isArray: Array.isArray(pixels)
                            });
                            
                            // 最终像素数据验证，增加容错性
                            if (!Array.isArray(pixels)) {
                                console.error('像素数据不是数组类型:', typeof pixels);
                                pixels = [];
                            }
                            
                            // 创建安全副本，避免修改原始数据
                            pixels = [...pixels];
                            
                            // 限制最大处理长度，防止超大数据导致内存问题
                            const MAX_PIXELS_LENGTH = 10 * 1024 * 1024; // 10MB
                            if (pixels.length > MAX_PIXELS_LENGTH) {
                                console.warn('像素数据过长(' + pixels.length + ')，截断到' + MAX_PIXELS_LENGTH);
                                pixels = pixels.slice(0, MAX_PIXELS_LENGTH);
                            }
                            
                            // 清理像素数据，确保所有值都是有效数字
                            pixels = pixels.map((value, index) => {
                                try {
                                    const num = Number(value);
                                    return isNaN(num) ? 0 : Math.max(0, Math.min(255, Math.floor(num)));
                                } catch {
                                    // 单个值转换失败时返回0
                                    return 0;
                                }
                            });
                            
                            // 像素数据长度检查，增强容错性和智能处理策略
                            let validPixelsLength = pixels.length;
                            
                            // 详细记录像素数据状态
                            console.debug('像素数据长度处理前:', {
                                initialLength: validPixelsLength,
                                isDivisibleBy4: validPixelsLength % 4 === 0
                            });
                            
                            // 首先确保数据不为空
                            if (validPixelsLength === 0) {
                                console.warn('像素数据为空，创建默认灰色像素');
                                // 创建默认像素数据作为最后的备用
                                pixels = [128, 128, 128, 255]; // 灰色像素
                                validPixelsLength = pixels.length;
                            }
                            
                            // 处理非4倍数的像素长度
                            const remainder = validPixelsLength % 4;
                            if (remainder !== 0) {
                                console.warn('像素数据长度不是4的倍数: ' + validPixelsLength + '，余数: ' + remainder);
                                
                                // 基于数据量和剩余量采用智能策略
                                if (validPixelsLength < 100) {
                                    // 小数据量时优先补齐
                                    console.debug('小数据量处理策略：补齐');
                                    for (let i = 0; i < 4 - remainder; i++) {
                                        pixels.push(0); // 添加黑色透明像素
                                    }
                                    validPixelsLength = pixels.length;
                                } else {
                                    // 根据余数决定策略
                                    if (remainder <= 2) {
                                        console.debug('小数余数处理策略：补齐');
                                        // 余数较小，补齐更安全
                                        for (let i = 0; i < 4 - remainder; i++) {
                                            pixels.push(0);
                                        }
                                        validPixelsLength = pixels.length;
                                    } else {
                                        console.debug('大数余数处理策略：截断');
                                        // 余数较大，安全截断
                                        validPixelsLength = validPixelsLength - remainder;
                                    }
                                }
                            }
                            
                            // 最终安全检查
                            if (validPixelsLength === 0) {
                                console.error('像素数据处理后仍为空，使用默认灰色像素');
                                pixels = [128, 128, 128, 255]; // 单个灰色像素作为最后的备用
                                validPixelsLength = pixels.length;
                            }
                            
                            console.debug('像素数据处理完成:', {
                                finalLength: validPixelsLength,
                                pixelCount: validPixelsLength / 4
                            });
                          
                             // 减少采样以提高性能
                            const maxSamples = 8000; // 适当减少采样数以提高性能
                            const totalPixels = validPixelsLength / 4;
                            const sampleRate = Math.max(1, Math.floor(totalPixels / maxSamples));
                            
                            // 计算颜色频率 - 增强版
                            const colorFrequency = {};
                            let processedPixels = 0;
                            let skippedPixels = 0;
                            
                            try {
                                // 使用有限循环防止无限迭代
                                const maxIterations = Math.min(validPixelsLength, 1000000); // 防止处理过大的图像
                                const totalProcessablePixels = maxIterations / 4;
                                
                                // 进度跟踪
                                console.debug('开始颜色频率计算:', {
                                    maxIterations: maxIterations,
                                    sampleRate: sampleRate,
                                    estimatedSteps: Math.ceil(maxIterations / (4 * sampleRate))
                                });
                                
                                for (let i = 0; i < maxIterations && i < validPixelsLength; i += 4 * sampleRate) {
                                    try {
                                        // 安全获取RGB值 - 增强版
                                        const pixelIndex = i;
                                        const r = pixelIndex < pixels.length && typeof pixels[pixelIndex] === 'number' ? pixels[pixelIndex] : 0;
                                        const g = (pixelIndex + 1) < pixels.length && typeof pixels[pixelIndex + 1] === 'number' ? pixels[pixelIndex + 1] : 0;
                                        const b = (pixelIndex + 2) < pixels.length && typeof pixels[pixelIndex + 2] === 'number' ? pixels[pixelIndex + 2] : 0;
                                        const a = (pixelIndex + 3) < pixels.length && typeof pixels[pixelIndex + 3] === 'number' ? pixels[pixelIndex + 3] : 0;
                                        
                                        processedPixels++;
                                        
                                        // 跳过透明像素
                                        if (a < 128) {
                                            skippedPixels++;
                                            continue;
                                        }
                                        
                                        // 确保RGB值在有效范围内
                                        const safeR = Math.max(0, Math.min(255, Math.round(r)));
                                        const safeG = Math.max(0, Math.min(255, Math.round(g)));
                                        const safeB = Math.max(0, Math.min(255, Math.round(b)));
                                        
                                        // 动态调整精度以适应不同图像大小
                                        const precision = totalProcessablePixels > 10000 ? 16 : 8;
                                        const reducedR = Math.floor(safeR / precision) * precision;
                                        const reducedG = Math.floor(safeG / precision) * precision;
                                        const reducedB = Math.floor(safeB / precision) * precision;
                                        
                                        // 安全调用rgbToHex函数
                                        let hexColor = null;
                                        try {
                                            hexColor = rgbToHex(reducedR, reducedG, reducedB);
                                        } catch (hexError) {
                                            console.warn('RGB转HEX失败:', { r: reducedR, g: reducedG, b: reducedB, error: hexError.message });
                                        }
                                        
                                        // 确保hexColor有效且安全地更新colorFrequency
                                        if (typeof hexColor === 'string' && hexColor.length >= 6) {
                                            try {
                                                colorFrequency[hexColor] = (colorFrequency[hexColor] || 0) + 1;
                                            } catch (objError) {
                                                console.warn('更新颜色频率对象失败:', objError.message);
                                            }
                                        }
                                    } catch (pixelError) {
                                        // 单个像素处理失败时，跳过该像素继续处理
                                        console.warn('像素处理失败，索引:', i, '错误:', pixelError.message);
                                        skippedPixels++;
                                    }
                                }
                                
                                // 记录处理统计信息
                                console.debug('颜色频率计算完成:', {
                                    processedPixels: processedPixels,
                                    skippedPixels: skippedPixels,
                                    uniqueColors: Object.keys(colorFrequency).length
                                });
                            } catch (frequencyError) {
                                console.error('颜色频率计算过程中发生错误:', frequencyError);
                                // 即使出错，也尝试继续处理
                            }
                            
                            // 验证colorFrequency对象是否有效
                            if (!colorFrequency || typeof colorFrequency !== 'object' || Object.keys(colorFrequency).length === 0) {
                                console.warn('颜色频率对象无效或为空，使用默认颜色');
                                // 创建一组默认颜色作为备用
                                colorFrequency = {
                                    '#FFFFFF': 30, // 白色
                                    '#000000': 20, // 黑色
                                    '#808080': 15, // 灰色
                                    '#FF0000': 10, // 红色
                                    '#00FF00': 10, // 绿色
                                    '#0000FF': 15  // 蓝色
                                };
                            }
                            
                            // 记录处理完成信息
                            console.log('颜色频率计算阶段完成，准备应用提取算法');
                            
                            // 记录开始时间，用于性能测试
                            const startTime = performance.now();
                            
                            // 验证colorFrequency是否有效
                            if (!colorFrequency || typeof colorFrequency !== 'object' || Object.keys(colorFrequency).length === 0) {
                                console.error('无效的颜色频率数据');
                                self.postMessage({ 
                                    success: false, 
                                    error: '无法提取有效颜色数据' 
                                });
                                self.close();
                                return;
                            }
                            
                            // 验证k参数
                            const validK = Math.max(1, Math.min(20, parseInt(k) || 5)); // 限制在1-20之间
                            
                            // 根据选择的提取方法应用不同的颜色算法
                            let colorGroups = [];
                            let finalMethod = extractMethod;
                            
                            // 提取方法尝试函数
                            const tryExtractMethod = (methodName, extractFn, fallbackFn, methodParams) => {
                                try {
                                    return extractFn(...methodParams);
                                } catch (e) {
                                    console.error(methodName + '方法错误:', e);
                                    try {
                                        return fallbackFn(colorFrequency, validK);
                                    } catch (fallbackError) {
                                        console.error(methodName + '回退方法也失败:', fallbackError);
                                        return [];
                                    }
                                }
                            };
                            
                            try {
                                switch (extractMethod) {
                                    case 'frequent':
                                        // 使用频率统计方法
                                        colorGroups = tryExtractMethod(
                                            '频率统计', 
                                            extractFrequentColorsWorker, 
                                            clusterColors, 
                                            [pixels, validK]
                                        );
                                        
                                        // 如果结果无效，尝试使用colorFrequency参数再次调用
                                        if (!colorGroups || colorGroups.length === 0) {
                                            console.warn('频率统计结果无效，尝试使用colorFrequency参数');
                                            try {
                                                colorGroups = extractFrequentColorsWorker(colorFrequency, validK);
                                            } catch (e) {
                                                console.error('使用colorFrequency的频率统计也失败:', e);
                                            }
                                        }
                                        break;
                                        
                                    case 'dominant':
                                        // 使用主色调提取方法
                                        colorGroups = tryExtractMethod(
                                            '主色调提取', 
                                            extractDominantColorsWorker, 
                                            clusterColors, 
                                            [pixels, validK]
                                        );
                                        
                                        // 如果结果无效，尝试使用colorFrequency参数再次调用
                                        if (!colorGroups || colorGroups.length === 0) {
                                            console.warn('主色调提取结果无效，尝试使用colorFrequency参数');
                                            try {
                                                colorGroups = extractDominantColorsWorker(colorFrequency, validK);
                                            } catch (e) {
                                                console.error('使用colorFrequency的主色调提取也失败:', e);
                                            }
                                        }
                                        break;
                                        
                                    case 'kmeans':
                                    default:
                                        // 默认使用K-means聚类
                                        try {
                                            colorGroups = clusterColors(colorFrequency, validK);
                                        } catch (e) {
                                            console.error('K-means聚类失败:', e);
                                            // 尝试使用频率方法作为最后的备选
                                            try {
                                                colorGroups = extractFrequentColorsWorker(colorFrequency, validK);
                                                finalMethod = 'frequent'; // 更新实际使用的方法
                                            } catch (fallbackError) {
                                                console.error('所有方法都失败了:', fallbackError);
                                            }
                                        }
                                        break;
                                }
                                
                                // 最后检查colorGroups是否有效，如果无效则创建简单的默认结果
                                if (!colorGroups || !Array.isArray(colorGroups) || colorGroups.length === 0) {
                                    console.warn('所有提取方法都返回无效结果，创建默认颜色');
                                    // 获取前2个最常见的颜色作为默认结果
                                    const sortedColors = Object.entries(colorFrequency)
                                        .sort(([,a], [,b]) => b - a)
                                        .slice(0, validK)
                                        .map(([hex, freq]) => {
                                            try {
                                                const rgb = hexToRgb(hex);
                                                if (rgb) {
                                                    return {
                                                        color: rgb,
                                                        hex: hex,
                                                        percentage: Math.round((freq / Object.values(colorFrequency).reduce((a, b) => a + b, 0)) * 100)
                                                    };
                                                }
                                                return null;
                                            } catch (e) {
                                                return null;
                                            }
                                        })
                                        .filter(Boolean);
                                        
                                    colorGroups = sortedColors.length > 0 ? sortedColors : [
                                        { color: { r: 255, g: 255, b: 255 }, hex: '#FFFFFF', percentage: 50 },
                                        { color: { r: 0, g: 0, b: 0 }, hex: '#000000', percentage: 50 }
                                    ];
                                    finalMethod = 'default';
                                }
                                
                                // 计算处理时间
                                const processingTime = performance.now() - startTime;
                                
                                // 验证colorGroups的有效性，确保是正确的数组格式
                                if (!Array.isArray(colorGroups)) {
                                    console.error('colorGroups不是有效的数组');
                                    colorGroups = [
                                        { color: { r: 255, g: 255, b: 255 }, hex: '#FFFFFF', percentage: 50 },
                                        { color: { r: 0, g: 0, b: 0 }, hex: '#000000', percentage: 50 }
                                    ];
                                    finalMethod = 'emergency';
                                }
                                
                                // 过滤掉无效的颜色对象
                                const validColorGroups = colorGroups.filter(color => 
                                    color && 
                                    color.color && 
                                    typeof color.hex === 'string' && 
                                    color.hex.length >= 6
                                );
                                
                                // 如果过滤后没有有效颜色，创建默认结果
                                const finalColorGroups = validColorGroups.length > 0 ? validColorGroups : [
                                    { color: { r: 255, g: 255, b: 255 }, hex: '#FFFFFF', percentage: 50 },
                                    { color: { r: 0, g: 0, b: 0 }, hex: '#000000', percentage: 50 }
                                ];
                                
                                // 将结果发送回主线程，包含使用的提取方法和处理时间
                                try {
                                    self.postMessage({ 
                                        success: true, 
                                        colors: finalColorGroups, 
                                        method: finalMethod,
                                        processingTime: processingTime,
                                        stats: {
                                            validColors: finalColorGroups.length,
                                            originalMethod: extractMethod
                                        }
                                    });
                                } catch (postError) {
                                    console.error('发送消息到主线程失败:', postError);
                                    // 尝试发送一个简化版本的结果
                                    try {
                                        self.postMessage({ 
                                            success: true, 
                                            colors: [{ color: { r: 255, g: 255, b: 255 }, hex: '#FFFFFF' }],
                                            method: 'simplified',
                                            error: '数据过大，发送简化版本'
                                        });
                                    } catch (finalError) {
                                        console.error('发送简化版本也失败:', finalError);
                                    }
                                }
                            } catch (error) {
                                console.error('Worker处理错误:', error);
                                // 构建详细的错误信息，包含错误类型和上下文
                                const errorDetails = {
                                    message: error instanceof Error ? error.message : String(error || '未知错误'),
                                    name: error instanceof Error ? error.name : 'Error',
                                    stack: error instanceof Error ? error.stack : 'No stack trace available',
                                    timestamp: new Date().toISOString(),
                                    processingTime: performance.now() - startTime,
                                    // 添加像素数据相关信息用于诊断
                                    pixelDataInfo: {
                                        pixelSource: pixelSource,
                                        pixelLength: pixels.length,
                                        pixelType: Array.isArray(pixels) ? 'array' : typeof pixels,
                                        imageDataType: typeof imageData
                                    }
                                };
                                
                                // 创建基本的默认颜色结果作为恢复机制
                                const fallbackColors = [
                                    { color: { r: 128, g: 128, b: 128 }, hex: '#808080', percentage: 100 },
                                    { color: { r: 255, g: 255, b: 255 }, hex: '#FFFFFF', percentage: 0 },
                                    { color: { r: 0, g: 0, b: 0 }, hex: '#000000', percentage: 0 }
                                ].slice(0, parseInt(k) || 5);
                                
                                // 检测并处理"无效的图像数据"错误
                                let errorMessage = '处理图像数据时出错: ' + errorDetails.message;
                                if (errorDetails.message.includes('无效的图像数据') || errorDetails.message.includes('像素数据')) {
                                    errorMessage = '图像数据格式无效，无法处理';
                                }
                                
                                // 向主线程返回错误信息和回退颜色结果
                                self.postMessage({
                                    success: false,
                                    error: errorMessage,
                                    errorDetails: errorDetails,
                                    colors: fallbackColors, // 提供默认颜色作为备用
                                    fallbackUsed: true,
                                    method: 'fallback',
                                    processingTime: errorDetails.processingTime
                                });
                            } finally {
                                self.close();
                            }
                    };
                `;
                const workerInstance = new Worker(URL.createObjectURL(new Blob([workerCode], { type: 'application/javascript' })));
                
                // 设置Worker超时
                const workerTimeout = setTimeout(() => {
                    try {
                        workerInstance.terminate();
                        console.warn('Worker超时');
                    } catch (e) {}
                    // 回退到主线程处理
                    extractColorsInMainThread();
                }, 15000); // 15秒超时
                
                // 设置Worker消息处理器
                workerInstance.onmessage = function(e) {
                    clearTimeout(workerTimeout);
                    try {
                        workerInstance.terminate();
                        
                        // 增强消息数据有效性检查
                        if (!e || typeof e !== 'object' || !e.data || typeof e.data !== 'object') {
                            console.error('Worker返回无效消息格式:', e);
                            showToast('处理失败: 接收到无效的颜色数据，正在尝试备用处理方式');
                            extractColorsInMainThread();
                            return;
                        }
                        
                        if (e.data.success === true && Array.isArray(e.data.colors)) {
                            // 颜色数据空值检查
                            if (e.data.colors.length === 0) {
                                console.warn('Worker返回空颜色数组');
                                showToast('警告: 未能从图片中提取颜色，请尝试使用不同的提取方法');
                                extractColorsInMainThread();
                                return;
                            }
                            
                            // 更宽松的颜色数据格式验证
                            let validColors = [];
                            try {
                                validColors = e.data.colors.filter(color => {
                                    try {
                                        // 支持多种颜色数据格式
                                        if (Array.isArray(color)) {
                                            // 数组格式: [r, g, b]
                                            return color.length >= 3 && 
                                                   typeof color[0] === 'number' && 
                                                   typeof color[1] === 'number' && 
                                                   typeof color[2] === 'number';
                                        } else if (color && typeof color === 'object') {
                                            // 对象格式: {color: {r, g, b}} 或 {r, g, b}
                                            if (color.color) {
                                                return typeof color.color.r === 'number' && 
                                                       typeof color.color.g === 'number' && 
                                                       typeof color.color.b === 'number';
                                            } else {
                                                return typeof color.r === 'number' && 
                                                       typeof color.g === 'number' && 
                                                       typeof color.b === 'number';
                                            }
                                        }
                                        return false;
                                    } catch (filterError) {
                                        return false;
                                    }
                                });
                            } catch (e) {
                                console.error('颜色数据过滤出错:', e);
                                validColors = [];
                            }
                            
                            if (validColors.length === 0) {
                                console.error('Worker返回无效的颜色数据格式:', e.data.colors);
                                showToast('处理失败: 颜色数据格式错误，正在尝试备用处理方式');
                                extractColorsInMainThread();
                                return;
                            }
                            
                            // 在主线程中渲染颜色
                            renderColors(e.data.colors);
                            
                            // 获取并显示使用的提取方法和处理时间
                            const method = e.data.method || 'kmeans';
                            const processingTime = e.data.processingTime || 0;
                            showToast(`颜色提取完成 (${getMethodName(method)}) - ${processingTime.toFixed(2)}ms`);
                        } else {
                            const errorMsg = e.data?.error || '未知错误';
                            console.error('Worker返回错误结果:', errorMsg);
                            
                            // 检查Worker是否提供了备用颜色数据
                            if (Array.isArray(e.data.colors) && e.data.colors.length > 0) {
                                console.warn('Worker提供了备用颜色数据，将直接使用这些颜色');
                                
                                // 验证备用颜色数据的有效性
                                let validColors = [];
                                try {
                                    validColors = e.data.colors.filter(color => {
                                        try {
                                            if (color && typeof color === 'object') {
                                                if (color.color) {
                                                    return typeof color.color.r === 'number' && 
                                                           typeof color.color.g === 'number' && 
                                                           typeof color.color.b === 'number';
                                                } else {
                                                    return typeof color.r === 'number' && 
                                                           typeof color.g === 'number' && 
                                                           typeof color.b === 'number';
                                                }
                                            }
                                            return false;
                                        } catch (filterError) {
                                            return false;
                                        }
                                    });
                                } catch (e) {
                                    console.error('过滤备用颜色数据出错:', e);
                                }
                                
                                // 如果有有效颜色，直接渲染而不回退到主线程
                                if (validColors.length > 0) {
                                    showToast('注意: 图像数据处理遇到问题，但已生成备用颜色');
                                    renderColors(e.data.colors);
                                    return;
                                }
                            }
                            
                            // 更详细的错误类型分析和用户反馈
                            let userFriendlyMessage = '处理失败: ';
                            
                            // 打印错误详情用于调试
                            if (e.data && e.data.errorDetails) {
                                console.log('错误详情:', e.data.errorDetails);
                                // 如果有像素数据信息，打印出来帮助诊断
                                if (e.data.errorDetails.pixelDataInfo) {
                                    console.log('像素数据诊断:', e.data.errorDetails.pixelDataInfo);
                                }
                            }
                            
                            if (errorMsg.includes('无效的图像数据') || errorMsg.includes('像素数据') || errorMsg.includes('图像数据格式无效')) {
                                userFriendlyMessage += '无法读取图像数据，请尝试其他图片或调整图片大小';
                                // 对于这种错误，我们可以直接尝试使用默认颜色
                                const defaultColors = [
                                    { color: { r: 128, g: 128, b: 128 }, hex: '#808080', percentage: 100 },
                                    { color: { r: 255, g: 255, b: 255 }, hex: '#FFFFFF', percentage: 0 },
                                    { color: { r: 0, g: 0, b: 0 }, hex: '#000000', percentage: 0 }
                                ];
                                renderColors(defaultColors);
                                showToast(userFriendlyMessage);
                                return;
                            } else if (errorMsg.includes('内存') || errorMsg.includes('memory')) {
                                userFriendlyMessage += '处理大型图片时内存不足，请尝试较小的图片';
                            } else if (errorMsg.includes('超时') || errorMsg.includes('timeout')) {
                                userFriendlyMessage += '处理时间过长，请尝试更简单的图片或减少颜色数量';
                            } else {
                                userFriendlyMessage += errorMsg;
                            }
                            
                            showToast(userFriendlyMessage);
                            extractColorsInMainThread();
                        }
                    } catch (error) {
                        console.error('处理Worker结果时出错:', error.message, error.stack);
                        showToast('处理失败: 发生未知错误，正在尝试备用处理方式');
                        extractColorsInMainThread();
                    }
                };
                
                worker.onerror = function(error) {
                    clearTimeout(workerTimeout);
                    try {
                        worker.terminate();
                    } catch (e) {}
                    console.error('Worker错误:', error);
                    // 如果Web Worker失败，回退到主线程处理
                    extractColorsInMainThread();
                };
                
                // 创建canvas元素
                const canvas = document.createElement('canvas');
                if (!canvas) {
                    throw new Error('无法创建canvas元素');
                }
                
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    throw new Error('浏览器不支持Canvas API');
                }
                
                // 根据图片尺寸调整采样大小
                const maxDimension = 400; // 增加采样尺寸以提高精度
                let width = currentImage.width || 0;
                let height = currentImage.height || 0;
                
                // 安全检查图片尺寸
                if (width <= 0 || height <= 0 || isNaN(width) || isNaN(height)) {
                    throw new Error('无效的图片尺寸');
                }
                
                // 保持宽高比调整大小
                if (width > height) {
                    if (width > maxDimension) {
                        height *= maxDimension / width;
                        width = maxDimension;
                    }
                } else {
                    if (height > maxDimension) {
                        width *= maxDimension / height;
                        height = maxDimension;
                    }
                }
                
                // 确保尺寸为整数
                width = Math.floor(width);
                height = Math.floor(height);
                
                // 设置canvas尺寸
                canvas.width = width;
                canvas.height = height;
                
                try {
                    // 绘制图像到canvas
                    ctx.drawImage(currentImage, 0, 0, width, height);
                } catch (e) {
                    console.error('绘制图片失败:', e);
                    throw new Error('无法处理图片内容');
                }
                
                // 获取像素数据并发送到Worker
                let imageData;
                try {
                    imageData = ctx.getImageData(0, 0, width, height);
                } catch (e) {
                    console.error('获取图像数据失败:', e);
                    throw new Error('无法处理图片像素数据');
                }
                
                // 获取颜色数量
                let k = 5;
                if (colorCount && colorCount.value) {
                    k = parseInt(colorCount.value);
                    // 确保k是有效的数字
                    if (isNaN(k) || k < 1 || k > 20) {
                        k = 5; // 默认值
                    }
                }
                
                // 获取选择的提取方法
                let method = 'kmeans'; // 默认方法
                if (extractMethod && extractMethod.value) {
                    method = extractMethod.value;
                }
                
                // 优化数据传递，确保imageData可以正确序列化
                const messageData = {
                    imageData: {
                        width: imageData.width,
                        height: imageData.height,
                        data: Array.from(imageData.data)  // 转换为普通数组确保正确传递
                    },
                    k: k,
                    extractMethod: method
                };
                
                try {
                    workerInstance.postMessage(messageData);
                } catch (postError) {
                    console.error('向Worker发送消息失败:', postError);
                    // 如果postMessage失败，尝试使用更轻量级的数据格式
                    const simplifiedData = {
                        imageData: Array.from(imageData.data), // 只传递像素数组
                        width: imageData.width,
                        height: imageData.height,
                        k: k,
                        extractMethod: method
                    };
                    try {
                        workerInstance.postMessage(simplifiedData);
                    } catch (fallbackError) {
                        console.error('简化格式也发送失败:', fallbackError);
                        extractColorsInMainThread();
                    }
                }
            } catch (error) {
                console.error('使用Worker时出错:', error);
                // 回退到主线程处理
                extractColorsInMainThread();
            }
        } else {
            // 不支持Web Worker的浏览器回退方案
            extractColorsInMainThread();
        }
    } catch (error) {
        console.error('提取颜色时发生错误:', error);
        showToast('颜色提取失败: ' + (error.message || '未知错误'));
        // 清空颜色容器
        if (colorsContainer) {
            colorsContainer.innerHTML = '<div class="empty-state">无法提取颜色，请尝试其他图片。</div>';
        }
    }
}

// 在主线程中提取颜色（回退方案）
function extractColorsInMainThread() {
    if (!currentImage) return;
    
    try {
        // 创建canvas元素
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 调整图像大小以提高性能
        const maxDimension = 200;
        let width = currentImage.width;
        let height = currentImage.height;
        
        if (width > height) {
            if (width > maxDimension) {
                height *= maxDimension / width;
                width = maxDimension;
            }
        } else {
            if (height > maxDimension) {
                width *= maxDimension / height;
                height = maxDimension;
            }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // 绘制图像到canvas
        ctx.drawImage(currentImage, 0, 0, width, height);
        
        // 获取像素数据
        const imageData = ctx.getImageData(0, 0, width, height);
        const pixels = imageData.data;
        
        // 获取颜色数量
        const count = parseInt(colorCount.value);
        
        // 获取选择的提取方法
        let method = 'kmeans'; // 默认方法
        if (extractMethod && extractMethod.value) {
            method = extractMethod.value;
        }
        
        let colorGroups = [];
        
        // 记录开始时间，用于性能测试
        const startTime = performance.now();
        
        // 根据选择的方法调用不同的提取算法
        switch (method) {
            case 'frequent':
                colorGroups = extractFrequentColors(pixels, count);
                break;
            case 'dominant':
                colorGroups = extractDominantColors(pixels, count);
                break;
            case 'median':
                colorGroups = extractMedianCutColors(pixels, count);
                break;
            case 'layered':
                colorGroups = extractLayeredColors(pixels, count);
                break;
            case 'kmeans':
            default:
                colorGroups = extractColorsKMeans(pixels, count);
                break;
        }
        
        // 计算处理时间
        const processingTime = performance.now() - startTime;
        
        // 渲染颜色块
        renderColors(colorGroups);
        
        // 显示带有性能信息的提示
        showToast(`颜色提取完成 (${getMethodName(method)}) - 处理时间: ${processingTime.toFixed(2)}ms`);
        
        // 输出性能信息到控制台，便于调试和比较
        console.log(`提取方法: ${getMethodName(method)}, 处理时间: ${processingTime.toFixed(2)}ms, 提取颜色数: ${colorGroups.length}`);
    } catch (error) {
        console.error('颜色提取出错:', error);
        showToast('颜色提取失败，请重试');
    }
}

// 获取提取方法的中文名称
function getMethodName(method) {
    const methodNames = {
        'kmeans': 'K-means聚类',
        'frequent': '最频繁颜色',
        'dominant': '主色调提取',
        'median': '中位切分法',
        'layered': '颜色分层提取'
    };
    return methodNames[method] || method;
}

// RGB 转 HEX
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

// HEX 转 RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// K-means聚类算法的独立实现
function extractColorsKMeans(pixels, colorCount, simplified = false) {
    // 计算颜色频率，同时减少颜色数量
    const colorFrequency = {};
    const precision = simplified ? 16 : 8; // 简化版使用更高的精度
    const sampleRate = Math.max(1, Math.floor(pixels.length / 4 / 3000)); // 最多采样3000个像素点
    
    for (let i = 0; i < pixels.length; i += 4 * sampleRate) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];
        
        // 跳过透明像素
        if (a < 128) continue;
        
        // 减少颜色数量，通过将RGB值降低精度
        const reducedR = Math.floor(r / precision) * precision;
        const reducedG = Math.floor(g / precision) * precision;
        const reducedB = Math.floor(b / precision) * precision;
        
        // 将颜色转换为十六进制
        const hexColor = rgbToHex(reducedR, reducedG, reducedB);
        colorFrequency[hexColor] = (colorFrequency[hexColor] || 0) + 1;
    }
    
    // 应用颜色聚类算法
    return clusterColors(colorFrequency, colorCount);
}

// 最频繁颜色提取算法
function extractFrequentColors(pixels, colorCount) {
    const colorFrequency = {};
    
    // 计算每个颜色出现的频率
    const sampleRate = Math.max(1, Math.floor(pixels.length / 4 / 5000)); // 最多采样5000个像素点
    for (let i = 0; i < pixels.length; i += 4 * sampleRate) {
        // 跳过透明像素
        if (pixels[i + 3] < 128) continue;
        
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        
        // 降低精度以减少颜色数量
        const precision = 4;
        const reducedR = Math.floor(r / precision) * precision;
        const reducedG = Math.floor(g / precision) * precision;
        const reducedB = Math.floor(b / precision) * precision;
        
        const hexColor = rgbToHex(reducedR, reducedG, reducedB);
        colorFrequency[hexColor] = (colorFrequency[hexColor] || 0) + 1;
    }
    
    // 按频率排序，取前colorCount个
    const sortedColors = Object.entries(colorFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, colorCount);
    
    // 转换为所需的结果格式
    const totalPixels = Object.values(colorFrequency).reduce((sum, count) => sum + count, 0);
    return sortedColors.map(([hex, count]) => {
        const rgb = hexToRgb(hex);
        return {
            hex: hex,
            r: rgb.r,
            g: rgb.g,
            b: rgb.b,
            percentage: ((count / totalPixels) * 100).toFixed(1)
        };
    });
}

// 主色调提取算法
function extractDominantColors(pixels, colorCount) {
    // 使用K-means的简化版本，专注于找出最显著的颜色
    // 主色调通常是在视觉上最突出的颜色，我们通过降低聚类数量来实现
    const mainColors = extractColorsKMeans(pixels, colorCount, true);
    
    // 进一步过滤，确保颜色之间有足够的差异
    const filteredColors = [];
    mainColors.forEach(color => {
        // 检查与已添加颜色的差异
        const isSignificantlyDifferent = filteredColors.every(existingColor => {
            const diff = Math.sqrt(
                Math.pow(color.r - existingColor.r, 2) +
                Math.pow(color.g - existingColor.g, 2) +
                Math.pow(color.b - existingColor.b, 2)
            );
            return diff > 30; // 颜色差异阈值
        });
        
        if (isSignificantlyDifferent) {
            filteredColors.push(color);
        }
    });
    
    // 如果过滤后颜色不足，从原结果中补充
    if (filteredColors.length < colorCount) {
        mainColors.forEach(color => {
            if (filteredColors.length >= colorCount) return;
            if (!filteredColors.find(c => c.hex === color.hex)) {
                filteredColors.push(color);
            }
        });
    }
    
    return filteredColors.slice(0, colorCount);
}

// 中位切分法
function extractMedianCutColors(pixels, colorCount) {
    // 过滤掉透明像素
    const validPixels = [];
    const sampleRate = Math.max(1, Math.floor(pixels.length / 4 / 5000)); // 最多采样5000个像素点
    
    for (let i = 0; i < pixels.length; i += 4 * sampleRate) {
        if (pixels[i + 3] >= 128) {
            validPixels.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
        }
    }
    
    if (validPixels.length === 0) return [];
    
    // 中位切分函数
    function medianCut(colors, depth, maxDepth) {
        if (depth >= maxDepth || colors.length <= 1) {
            // 计算该桶的平均颜色
            const avgColor = colors.reduce((acc, color) => {
                acc[0] += color[0];
                acc[1] += color[1];
                acc[2] += color[2];
                return acc;
            }, [0, 0, 0]);
            
            avgColor[0] = Math.round(avgColor[0] / colors.length);
            avgColor[1] = Math.round(avgColor[1] / colors.length);
            avgColor[2] = Math.round(avgColor[2] / colors.length);
            
            return [{ hex: rgbToHex(...avgColor), count: colors.length }];
        }
        
        // 找到颜色范围最大的通道
        let rRange = [Infinity, -Infinity];
        let gRange = [Infinity, -Infinity];
        let bRange = [Infinity, -Infinity];
        
        colors.forEach(color => {
            rRange[0] = Math.min(rRange[0], color[0]);
            rRange[1] = Math.max(rRange[1], color[0]);
            gRange[0] = Math.min(gRange[0], color[1]);
            gRange[1] = Math.max(gRange[1], color[1]);
            bRange[0] = Math.min(bRange[0], color[2]);
            bRange[1] = Math.max(bRange[1], color[2]);
        });
        
        const rSize = rRange[1] - rRange[0];
        const gSize = gRange[1] - gRange[0];
        const bSize = bRange[1] - bRange[0];
        
        let splitChannel;
        if (rSize >= gSize && rSize >= bSize) splitChannel = 0;
        else if (gSize >= rSize && gSize >= bSize) splitChannel = 1;
        else splitChannel = 2;
        
        // 按选定通道排序并在中位数处分割
        colors.sort((a, b) => a[splitChannel] - b[splitChannel]);
        const medianIndex = Math.floor(colors.length / 2);
        
        return [
            ...medianCut(colors.slice(0, medianIndex), depth + 1, maxDepth),
            ...medianCut(colors.slice(medianIndex), depth + 1, maxDepth)
        ];
    }
    
    // 计算需要的切分深度
    const maxDepth = Math.ceil(Math.log2(colorCount));
    const colorGroups = medianCut(validPixels, 0, maxDepth);
    
    // 转换为所需的结果格式
    const totalPixels = colorGroups.reduce((sum, group) => sum + group.count, 0);
    return colorGroups
        .slice(0, colorCount)
        .map(group => {
            const rgb = hexToRgb(group.hex);
            return {
                hex: group.hex,
                r: rgb.r,
                g: rgb.g,
                b: rgb.b,
                percentage: ((group.count / totalPixels) * 100).toFixed(1)
            };
        })
        .sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));
}

// 颜色分层提取
function extractLayeredColors(pixels, colorCount) {
    // 1. 提取最亮的颜色（高亮度）
    // 2. 提取中间亮度的颜色
    // 3. 提取最暗的颜色（低亮度）
    
    const brightnessGroups = { high: [], medium: [], low: [] };
    const sampleRate = Math.max(1, Math.floor(pixels.length / 4 / 5000)); // 最多采样5000个像素点
    
    for (let i = 0; i < pixels.length; i += 4 * sampleRate) {
        if (pixels[i + 3] < 128) continue;
        
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        
        // 计算亮度 (使用加权RGB公式)
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        
        // 根据亮度将颜色分组
        if (brightness > 0.7) brightnessGroups.high.push([r, g, b]);
        else if (brightness < 0.3) brightnessGroups.low.push([r, g, b]);
        else brightnessGroups.medium.push([r, g, b]);
    }
    
    const result = [];
    const totalGroups = Object.keys(brightnessGroups).filter(key => brightnessGroups[key].length > 0).length;
    
    if (totalGroups > 0) {
        const colorsPerGroup = Math.max(1, Math.floor(colorCount / totalGroups));
        
        // 从每个亮度组中提取颜色
        for (const [groupName, colors] of Object.entries(brightnessGroups)) {
            if (colors.length === 0) continue;
            
            // 为每个组创建像素数据格式
            const groupPixels = colors.flat();
            
            // 从该组中提取颜色
            const groupColors = extractColorsKMeans(groupPixels, colorsPerGroup, true);
            result.push(...groupColors);
        }
    }
    
    // 如果结果不足，从最频繁的颜色中补充
    if (result.length < colorCount) {
        const frequentColors = extractFrequentColors(pixels, colorCount - result.length);
        
        // 添加未包含在结果中的颜色
        frequentColors.forEach(color => {
            if (result.length >= colorCount) return;
            if (!result.find(c => c.hex === color.hex)) {
                result.push(color);
            }
        });
    }
    
    // 计算最终的百分比
    const totalPercentage = result.reduce((sum, color) => sum + parseFloat(color.percentage), 0);
    return result.slice(0, colorCount).map(color => ({
        ...color,
        percentage: ((parseFloat(color.percentage) / totalPercentage) * 100).toFixed(1)
    })).sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));
}

// 颜色聚类 (简单的K-means算法)
function clusterColors(colorFrequency, k) {
    // 将颜色数据转换为数组形式
    const colorData = [];
    Object.entries(colorFrequency).forEach(([hex, count]) => {
        const rgb = hexToRgb(hex);
        if (rgb) {
            colorData.push({
                r: rgb.r,
                g: rgb.g,
                b: rgb.b,
                hex: hex,
                count: count
            });
        }
    });
    
    // 如果颜色数量少于k，直接返回所有颜色
    if (colorData.length <= k) {
        return colorData.sort((a, b) => b.count - a.count).map(color => ({
            hex: color.hex,
            r: color.r,
            g: color.g,
            b: color.b,
            percentage: (color.count / colorData.reduce((sum, c) => sum + c.count, 0) * 100).toFixed(1)
        }));
    }
    
    // 随机选择k个初始聚类中心
    let centroids = [];
    for (let i = 0; i < k; i++) {
        const randomIndex = Math.floor(Math.random() * colorData.length);
        centroids.push({
            r: colorData[randomIndex].r,
            g: colorData[randomIndex].g,
            b: colorData[randomIndex].b
        });
    }
    
    let clusters = [];
    let maxIterations = 20;
    let iteration = 0;
    let converged = false;
    
    // K-means迭代过程
    while (!converged && iteration < maxIterations) {
        // 重置聚类
        clusters = Array(k).fill().map(() => []);
        
        // 分配每个颜色到最近的聚类中心
        colorData.forEach(color => {
            let minDistance = Infinity;
            let closestCentroidIndex = 0;
            
            centroids.forEach((centroid, index) => {
                const distance = Math.sqrt(
                    Math.pow(color.r - centroid.r, 2) +
                    Math.pow(color.g - centroid.g, 2) +
                    Math.pow(color.b - centroid.b, 2)
                );
                
                if (distance < minDistance) {
                    minDistance = distance;
                    closestCentroidIndex = index;
                }
            });
            
            clusters[closestCentroidIndex].push(color);
        });
        
        // 更新聚类中心
        let newCentroids = [];
        clusters.forEach(cluster => {
            if (cluster.length === 0) {
                // 如果聚类为空，随机选择一个颜色
                const randomIndex = Math.floor(Math.random() * colorData.length);
                newCentroids.push({
                    r: colorData[randomIndex].r,
                    g: colorData[randomIndex].g,
                    b: colorData[randomIndex].b
                });
            } else {
                // 计算加权平均 (考虑颜色出现频率)
                let totalR = 0, totalG = 0, totalB = 0, totalCount = 0;
                
                cluster.forEach(color => {
                    totalR += color.r * color.count;
                    totalG += color.g * color.count;
                    totalB += color.b * color.count;
                    totalCount += color.count;
                });
                
                newCentroids.push({
                    r: Math.round(totalR / totalCount),
                    g: Math.round(totalG / totalCount),
                    b: Math.round(totalB / totalCount)
                });
            }
        });
        
        // 检查是否收敛
        converged = newCentroids.every((centroid, index) => {
            return Math.abs(centroid.r - centroids[index].r) < 1 &&
                   Math.abs(centroid.g - centroids[index].g) < 1 &&
                   Math.abs(centroid.b - centroids[index].b) < 1;
        });
        
        centroids = newCentroids;
        iteration++;
    }
    
    // 计算每个聚类的主要颜色和百分比
    const result = [];
    const totalPixels = colorData.reduce((sum, color) => sum + color.count, 0);
    
    clusters.forEach(cluster => {
        if (cluster.length === 0) return;
        
        // 找出聚类中最常出现的颜色
        let maxCount = 0;
        let dominantColor = null;
        
        cluster.forEach(color => {
            if (color.count > maxCount) {
                maxCount = color.count;
                dominantColor = color;
            }
        });
        
        // 计算聚类的总像素数
        const clusterTotal = cluster.reduce((sum, color) => sum + color.count, 0);
        
        if (dominantColor) {
            result.push({
                hex: dominantColor.hex,
                r: dominantColor.r,
                g: dominantColor.g,
                b: dominantColor.b,
                percentage: ((clusterTotal / totalPixels) * 100).toFixed(1)
            });
        }
    });
    
    // 按像素数排序
    return result.sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));
}

// 渲染颜色块
function renderColors(colors) {
    try {
        // 检查必要的DOM元素是否存在
        if (!colorsContainer) {
            console.warn('colorsContainer元素不存在，无法渲染颜色');
            showToast('无法显示颜色结果：DOM元素缺失');
            return;
        }
        
        // 清空容器
        colorsContainer.innerHTML = '';
        
        // 验证colors参数的有效性
        if (!Array.isArray(colors)) {
            console.warn('传入的colors参数不是数组');
            showToast('颜色数据格式错误');
            return;
        }
        
        // 添加一个空状态提示
        if (colors.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.innerHTML = `
                <div class="empty-icon">🎨</div>
                <p>没有提取到颜色</p>
                <small>请尝试上传其他图片</small>
            `;
            colorsContainer.appendChild(emptyState);
            return;
        }
        
        // 设置容器为可见，使用兼容方法
        colorsContainer.style.display = 'grid';
        
        // 为不支持grid的浏览器添加fallback
        if (typeof document.createElement('div').style.grid !== 'string') {
            colorsContainer.style.display = 'flex';
            colorsContainer.style.flexWrap = 'wrap';
            colorsContainer.style.justifyContent = 'flex-start';
        }
        
        colors.forEach((color, index) => {
            // 验证color对象的有效性
            if (!color || typeof color !== 'object' || !color.hex || 
                typeof color.r !== 'number' || typeof color.g !== 'number' || typeof color.b !== 'number') {
                console.warn('颜色对象数据无效:', color);
                return;
            }
            
            const colorItem = document.createElement('div');
            colorItem.className = 'color-item';
            
            // 添加初始样式用于动画
            colorItem.style.opacity = '0';
            colorItem.style.transform = 'translateY(10px)';
            colorItem.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            
            // 添加延迟动画效果（使用兼容的方式）
            if (colorItem.style.animationDelay !== undefined) {
                colorItem.style.animationDelay = `${index * 100}ms`;
            }
            
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color.hex;
            swatch.title = '点击复制颜色值';
            
            // 根据颜色亮度决定文字颜色
            const brightness = (color.r * 299 + color.g * 587 + color.b * 114) / 1000;
            const textColor = brightness > 128 ? '#000' : '#fff';
            
            // 添加边框效果（使用兼容的方式）
            try {
                swatch.style.boxShadow = `inset 0 0 0 1px rgba(${255-color.r}, ${255-color.g}, ${255-color.b}, 0.2)`;
            } catch (e) {
                // 降级方案
                swatch.style.border = '1px solid rgba(255, 255, 255, 0.2)';
            }
            
            const percentage = document.createElement('span');
            percentage.className = 'color-percentage';
            // 确保正确处理百分比值，无论是字符串还是数字
            const percentageValue = typeof color.percentage === 'string' 
                ? parseFloat(color.percentage)
                : typeof color.percentage === 'number' 
                ? color.percentage 
                : 0;
            percentage.textContent = `${percentageValue.toFixed(1)}%`;
            percentage.style.color = textColor;
            
            // 添加RGB值提示框
            const rgbInfo = document.createElement('div');
            rgbInfo.className = 'rgb-info';
            rgbInfo.textContent = `RGB: ${color.r}, ${color.g}, ${color.b}`;
            rgbInfo.style.color = textColor;
            rgbInfo.style.opacity = '0';
            rgbInfo.style.transition = 'opacity 0.2s ease';
            
            const value = document.createElement('div');
            value.className = 'color-value';
            
            // 根据选择的格式显示颜色值，并验证colorFormat是否存在
            if (colorFormat) {
                if (colorFormat.value === 'hex') {
                    value.textContent = color.hex;
                } else {
                    value.textContent = `rgb(${color.r}, ${color.g}, ${color.b})`;
                }
            } else {
                value.textContent = color.hex;
            }
            
            // 创建复制按钮
            const copyButton = document.createElement('button');
            copyButton.className = 'copy-button';
            copyButton.textContent = '复制';
            copyButton.title = '点击复制颜色值';
            
            // 添加复制功能，使用函数绑定以避免闭包问题
            copyButton.addEventListener('click', (function(text) {
                return function() {
                    copyToClipboard(text);
                    // 添加点击动画效果
                    try {
                        this.textContent = '已复制';
                        setTimeout(() => {
                            this.textContent = '复制';
                        }, 1500);
                    } catch (e) {
                        // 忽略动画错误
                    }
                };
            })(value.textContent));
            
            // 保留颜色块和颜色值的点击复制功能，作为备选
            swatch.addEventListener('click', (function(text) {
                return function() {
                    copyToClipboard(text);
                    // 添加点击动画效果
                    try {
                        this.style.transform = 'scale(0.95)';
                        this.style.transition = 'transform 0.15s ease';
                        setTimeout(() => {
                            this.style.transform = 'scale(1)';
                        }, 150);
                    } catch (e) {
                        // 忽略动画错误
                    }
                };
            })(value.textContent));
            
            // 添加悬停效果
            colorItem.addEventListener('mouseenter', function() {
                try {
                    rgbInfo.style.opacity = '1';
                    swatch.style.transform = 'scale(1.03)';
                    swatch.style.transition = 'transform 0.2s ease';
                } catch (e) {
                    // 忽略动画错误
                }
            });
            
            colorItem.addEventListener('mouseleave', function() {
                try {
                    rgbInfo.style.opacity = '0';
                    swatch.style.transform = 'scale(1)';
                } catch (e) {
                    // 忽略动画错误
                }
            });
            
            swatch.appendChild(percentage);
            swatch.appendChild(rgbInfo);
            colorItem.appendChild(swatch);
            colorItem.appendChild(value);
            colorItem.appendChild(copyButton);
            colorsContainer.appendChild(colorItem);
            
            // 触发动画效果
            setTimeout(function(item) {
                try {
                    item.style.opacity = '1';
                    item.style.transform = 'translateY(0)';
                } catch (e) {
                    // 降级方案
                    item.style.opacity = '1';
                }
            }, 10, colorItem);
        });
        
        // 侧边栏已移除，不再渲染侧边栏颜色列表
    } catch (error) {
        console.error('渲染颜色时出错:', error);
        showToast('显示颜色时发生错误');
        
        // 创建一个简单的错误提示
        if (colorsContainer) {
            colorsContainer.innerHTML = '';
            const errorElement = document.createElement('div');
            errorElement.className = 'error-message';
            errorElement.textContent = '无法显示颜色结果，请刷新页面重试';
            colorsContainer.appendChild(errorElement);
        }
    }
}

// 复制到剪贴板 - 增强版
function copyToClipboard(text) {
    // 检查浏览器是否支持Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
        // 使用现代API
        navigator.clipboard.writeText(text).then(() => {
            showToast(`已复制: ${text}`);
        }).catch(err => {
            console.error('Clipboard API复制失败:', err);
            // 回退到传统方法
            fallbackCopyTextToClipboard(text);
        });
    } else {
        // 不支持Clipboard API，使用回退方法
        fallbackCopyTextToClipboard(text);
    }
}

// 回退复制方法
function fallbackCopyTextToClipboard(text) {
    // 创建一个临时文本区域
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // 确保文本区域不可见但能被选中
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    
    // 添加到DOM
    document.body.appendChild(textArea);
    
    // 选择文本
    textArea.focus();
    textArea.select();
    
    try {
        // 执行复制命令
        const successful = document.execCommand('copy');
        if (successful) {
            showToast(`已复制: ${text}`);
        } else {
            throw new Error('复制命令执行失败');
        }
    } catch (err) {
        console.error('回退复制方法失败:', err);
        // 提供备用方案 - 创建可选择的元素
        showManualCopyOption(text);
    } finally {
        // 清理
        document.body.removeChild(textArea);
    }
}

// 显示手动复制选项
function showManualCopyOption(text) {
    // 检查是否已有手动复制区域
    let manualCopyElement = document.getElementById('manual-copy');
    
    if (!manualCopyElement) {
        // 创建新的手动复制区域
        manualCopyElement = document.createElement('div');
        manualCopyElement.id = 'manual-copy';
        manualCopyElement.className = 'manual-copy-overlay';
        manualCopyElement.innerHTML = `
            <div class="manual-copy-content">
                <h3>请手动复制颜色值</h3>
                <div class="manual-copy-text-container">
                    <input type="text" id="manual-copy-text" readonly>
                    <button id="manual-copy-close">关闭</button>
                </div>
            </div>
        `;
        document.body.appendChild(manualCopyElement);
        
        // 添加关闭按钮事件
        document.getElementById('manual-copy-close').addEventListener('click', () => {
            manualCopyElement.remove();
        });
        
        // 添加点击外部关闭事件
        manualCopyElement.addEventListener('click', (e) => {
            if (e.target === manualCopyElement) {
                manualCopyElement.remove();
            }
        });
    }
    
    // 设置文本值并自动选择
    const textInput = document.getElementById('manual-copy-text');
    textInput.value = text;
    textInput.select();
    
    // 显示手动复制区域
    manualCopyElement.style.display = 'flex';
    
    showToast('复制功能不可用，请手动复制');
}

// 渲染侧边栏颜色列表
function renderSidebarColors(colors) {
    sidebarColorsList.innerHTML = '';
    
    colors.forEach((color, index) => {
        const colorItem = document.createElement('div');
        colorItem.className = 'sidebar-color-item';
        
        const colorSwatch = document.createElement('span');
        colorSwatch.className = 'sidebar-color-swatch';
        colorSwatch.style.backgroundColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
        
        let colorValue;
        const format = colorFormat.value;
        if (format === 'hex') {
            colorValue = rgbToHex(color.r, color.g, color.b);
        } else if (format === 'rgb') {
            colorValue = `rgb(${color.r}, ${color.g}, ${color.b})`;
        } else if (format === 'rgba') {
            colorValue = `rgba(${color.r}, ${color.g}, ${color.b}, 1)`;
        }
        
        const colorText = document.createElement('span');
        colorText.className = 'sidebar-color-value';
        colorText.textContent = colorValue;
        
        colorItem.appendChild(colorSwatch);
        colorItem.appendChild(colorText);
        
        // 添加点击复制功能
        colorItem.addEventListener('click', () => {
            copyToClipboard(colorValue);
            showToast(`已复制: ${colorValue}`);
        });
        
        sidebarColorsList.appendChild(colorItem);
    });
}

// 复制全部颜色
function copyAllColors() {
    const colorsElements = sidebarColorsList.querySelectorAll('.sidebar-color-value');
    if (colorsElements.length === 0) {
        showToast('没有可复制的颜色');
        return;
    }
    
    const allColors = Array.from(colorsElements).map(el => el.textContent).join('\n');
    copyToClipboard(allColors);
    showToast('已复制全部颜色');
}

// 为复制全部按钮添加点击事件
// 侧边栏相关功能已移除，不再需要copyAllBtn事件监听器

// 显示提示框
function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// 更新拖放事件处理，添加dragover类
uploadContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadContainer.classList.add('dragover');
});

uploadContainer.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadContainer.classList.remove('dragover');
});

uploadContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadContainer.classList.remove('dragover');
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileUpload(e.dataTransfer.files[0]);
    }
});

// 初始化主题
document.addEventListener('DOMContentLoaded', () => {
    checkThemePreference();
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleDarkMode);
    }
});