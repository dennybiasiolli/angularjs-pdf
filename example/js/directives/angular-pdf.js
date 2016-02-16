/*! Angular-PDF Version: 1.3.0 | Released under an MIT license */
/* global angular, PDFJS */
(function() {

  'use strict';

  angular.module('pdf', []).directive('ngPdf', [ '$window', function($window) {
    var renderTask = null;
    var pdfLoaderTask = null;
    var debug = false;

    var backingScale = function(canvas) {
      var ctx = canvas.getContext('2d');
      var dpr = window.devicePixelRatio || 1;
      var bsr = ctx.webkitBackingStorePixelRatio ||
        ctx.mozBackingStorePixelRatio ||
        ctx.msBackingStorePixelRatio ||
        ctx.oBackingStorePixelRatio ||
        ctx.backingStorePixelRatio || 1;

      return dpr / bsr;
    };

    var setCanvasDimensions = function(canvas, w, h) {
      var ratio = backingScale(canvas);
      canvas.width = Math.floor(w * ratio);
      canvas.height = Math.floor(h * ratio);
      canvas.style.width = Math.floor(w) + 'px';
      canvas.style.height = Math.floor(h) + 'px';
      canvas.getContext('2d').setTransform(ratio, 0, 0, ratio, 0, 0);
      return canvas;
    };
    return {
      restrict: 'E',
      templateUrl: function(element, attr) {
        return attr.templateUrl ? attr.templateUrl : 'partials/viewer.html';
      },
      link: function(scope, element, attrs) {
        element.css('display', 'block');
        var url = scope.pdfUrl;
        var httpHeaders = scope.httpHeaders;
        var pdfDoc = null;
        var pageToDisplay = isFinite(attrs.page) ? parseInt(attrs.page) : 1;
        var pageFit = attrs.scale === 'page-fit';
        var scale = attrs.scale > 0 ? attrs.scale : 1;
        var canvasid = attrs.canvasid || 'pdf-canvas';
        var canvas = document.getElementById(canvasid);

        debug = attrs.hasOwnProperty('debug') ? attrs.debug : false;
        var creds = attrs.usecredentials;
        var ctx = canvas.getContext('2d');
        var windowEl = angular.element($window);

        windowEl.on('scroll', function() {
          scope.$apply(function() {
            scope.scroll = windowEl[0].scrollY;
          });
        });

        PDFJS.disableWorker = true;
        scope.pageNum = pageToDisplay;

        scope.renderPage = function(num) {
          if (renderTask) {
              renderTask._internalRenderTask.cancel();
          }

          pdfDoc.getPage(num).then(function(page) {
            var viewport;
            var pageWidthScale;
            var renderContext;

            if (pageFit) {
              viewport = page.getViewport(1);
              var clientRect = element[0].getBoundingClientRect();
              pageWidthScale = clientRect.width / viewport.width;
              scale = pageWidthScale;
            }
            viewport = page.getViewport(scale);

            setCanvasDimensions(canvas, viewport.width, viewport.height);

            renderContext = {
              canvasContext: ctx,
              viewport: viewport
            };

            renderTask = page.render(renderContext);
            renderTask.promise.then(function() {
                if (typeof scope.onPageRender === 'function') {
                    scope.onPageRender();
                }
            }).catch(function (reason) {
                console.log(reason);
            });
          });
        };

        scope.goPrevious = function() {
          if (scope.pageToDisplay <= 1) {
            return;
          }
          scope.pageToDisplay = parseInt(scope.pageToDisplay) - 1;
          scope.pageNum = scope.pageToDisplay;
        };

        scope.goNext = function() {
          if (scope.pageToDisplay >= pdfDoc.numPages) {
            return;
          }
          scope.pageToDisplay = parseInt(scope.pageToDisplay) + 1;
          scope.pageNum = scope.pageToDisplay;
        };

        scope.zoomIn = function() {
          pageFit = false;
          scale = parseFloat(scale) + 0.2;
          scope.renderPage(scope.pageToDisplay);
          return scale;
        };

        scope.zoomOut = function() {
          pageFit = false;
          scale = parseFloat(scale) - 0.2;
          scope.renderPage(scope.pageToDisplay);
          return scale;
        };

        scope.fit = function() {
          pageFit = true;
          scope.renderPage(scope.pageToDisplay);
        }

        scope.changePage = function() {
          scope.renderPage(scope.pageToDisplay);
        };

        scope.rotate = function() {
          if (canvas.getAttribute('class') === 'rotate0') {
            canvas.setAttribute('class', 'rotate90');
          } else if (canvas.getAttribute('class') === 'rotate90') {
            canvas.setAttribute('class', 'rotate180');
          } else if (canvas.getAttribute('class') === 'rotate180') {
            canvas.setAttribute('class', 'rotate270');
          } else {
            canvas.setAttribute('class', 'rotate0');
          }
        };

        function clearCanvas() {
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        }

        function renderPDF() {

          PDFJS.imageResourcesPath = './images/';

          // var pdfRenderingQueue = new PDFJS.PDFRenderingQueue();
          // pdfRenderingQueue.onIdle = this.cleanup.bind(this);
          // this.pdfRenderingQueue = pdfRenderingQueue;

          var pdfLinkService = new PDFJS.PDFLinkService();
          // this.pdfLinkService = pdfLinkService;

          var container = document.getElementById('viewerContainer');
          var viewer = document.getElementById('viewer');
          var pdfViewer = new PDFJS.PDFViewer({
            container: container,
            viewer: viewer,
            // renderingQueue: pdfRenderingQueue,
            linkService: pdfLinkService
          });
          // pdfRenderingQueue.setViewer(pdfViewer);
          pdfLinkService.setViewer(pdfViewer);

          var scale = 0;
          var loadingTask = PDFJS.getDocument({'url': url});
          var pdfLoadingTask = loadingTask;
          var result = loadingTask.promise.then(
            function getDocumentCallback(pdfDocument) {
              var self = this;
              scale = scale || 1;
              // var pagesCount = pdfDocument.numPages;
              // var id = pdfDocument.fingerprint;
              var baseDocumentUrl = null;
              pdfLinkService.setDocument(pdfDocument, baseDocumentUrl);
              pdfViewer.currentPageNumber = 13;
              pdfViewer.currentScale = scale;
              pdfViewer.setDocument(pdfDocument);
            },
            function getDocumentError(exception) { }
          );
          
          console.log(PDFJS);
      



          clearCanvas();

          var params = {
            'url': url,
            'withCredentials': creds
          };

          if (httpHeaders) {
            params.httpHeaders = httpHeaders;
          }

          if (url && url.length) {
            pdfLoaderTask = PDFJS.getDocument(params);
            pdfLoaderTask.then(
                function(_pdfDoc) {
                  if (typeof scope.onLoad === 'function') {
                    scope.onLoad();
                  }

                  pdfDoc = _pdfDoc;
                  scope.renderPage(scope.pageToDisplay);

                  scope.$apply(function() {
                    scope.pageCount = _pdfDoc.numPages;
                  });
                }, function(error) {
                  if (error) {
                    if (typeof scope.onError === 'function') {
                      scope.onError(error);
                    }
                  }
                }
            );
          }
        }

        scope.$watch('pageNum', function(newVal) {
          scope.pageToDisplay = parseInt(newVal);
          if (pdfDoc !== null) {
            scope.renderPage(scope.pageToDisplay);
          }
        });

        scope.$watch('pdfUrl', function(newVal) {
          if (newVal !== '') {
            if (debug) {
              console.log('pdfUrl value change detected: ', scope.pdfUrl);
            }
            url = newVal;
            scope.pageNum = scope.pageToDisplay = pageToDisplay;
            if (pdfLoaderTask) {
                pdfLoaderTask.destroy().then(function () {
                    renderPDF();
                });
            } else {
                renderPDF();
            }
          }
        });

      }
    };
  } ]);
})();
