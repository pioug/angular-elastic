if (
  typeof module !== "undefined" &&
  typeof exports !== "undefined" &&
  module.exports === exports
) {
  module.exports = "monospaced.elastic";
}

angular
  .module("monospaced.elastic", [])

  .constant("msdElasticConfig", {
    append: ""
  })

  .directive("msdElastic", [
    "$timeout",
    "$window",
    "msdElasticConfig",
    function($timeout, $window, config) {
      "use strict";

      return {
        require: "ngModel",
        restrict: "A, C",
        link: function(scope, element, attrs, ngModel) {
          // cache a reference to the DOM element
          var ta = element[0],
            $ta = element;

          // ensure the element is a textarea, and browser is capable
          if (ta.nodeName !== "TEXTAREA" || !$window.getComputedStyle) {
            return;
          }

          // set these properties before measuring dimensions
          $ta.css({
            overflow: "hidden",
            "overflow-y": "hidden",
            "word-wrap": "break-word"
          });

          // force text reflow
          var text = ta.value;
          ta.value = "";
          ta.value = text;

          var append = attrs.msdElastic
              ? attrs.msdElastic.replace(/\\n/g, "\n")
              : config.append,
            $win = angular.element($window),
            mirrorInitStyle =
              "position: absolute; top: -999px; right: auto; bottom: auto;" +
              "left: 0; overflow: hidden; -webkit-box-sizing: content-box;" +
              "-moz-box-sizing: content-box; box-sizing: content-box;" +
              "min-height: 0 !important; height: 0 !important; padding: 0;" +
              "word-wrap: break-word; border: 0; margin: 0;",
            $mirror = angular
              .element(
                '<textarea aria-hidden="true" tabindex="-1" ' +
                  'style="' +
                  mirrorInitStyle +
                  '"/>'
              )
              .data("elastic", true),
            mirror = $mirror[0],
            taStyle = getComputedStyle(ta),
            resize = taStyle.getPropertyValue("resize"),
            mirrored,
            active,
            copyStyle = [
              "font-family",
              "font-size",
              "font-weight",
              "font-style",
              "letter-spacing",
              "line-height",
              "text-transform",
              "word-spacing",
              "text-indent"
            ];

          // exit if elastic already applied (or is the mirror element)
          if ($ta.data("elastic")) {
            return;
          }

          // set resize and apply elastic
          $ta
            .css({
              resize:
                resize === "" || resize === "none" || resize === "vertical"
                  ? "none"
                  : "horizontal"
            })
            .data("elastic", true);

          /*
           * methods
           */

          function initMirror() {
            var mirrorStyle = mirrorInitStyle;

            mirrored = ta;
            // copy the essential styles from the textarea to the mirror
            taStyle = getComputedStyle(ta);
            angular.forEach(copyStyle, function(val) {
              mirrorStyle += val + ":" + taStyle.getPropertyValue(val) + ";";
            });
            mirror.setAttribute("style", mirrorStyle);
          }

          function adjust() {
            var borderBox,
              boxOuter,
              heightValue,
              maxHeight,
              minHeight,
              minHeightValue,
              mirrorHeight,
              overflow,
              taComputedStyle,
              taComputedStyleWidth,
              taHeight,
              width;

            if (mirrored !== ta) {
              initMirror();
            }

            // active flag prevents actions in function from calling adjust again
            if (!active) {
              active = true;

              mirror.value = ta.value + append; // optional whitespace to improve animation
              mirror.style.overflowY = ta.style.overflowY;

              taHeight =
                ta.style.height === "" ? "auto" : parseInt(ta.style.height, 10);

              taComputedStyle = getComputedStyle(ta);
              taComputedStyleWidth = taComputedStyle.getPropertyValue("width");

              maxHeight = parseInt(
                taComputedStyle.getPropertyValue("max-height"),
                10
              );

              // Opera returns max-height of -1 if not set
              maxHeight = maxHeight && maxHeight > 0 ? maxHeight : 9e4;

              borderBox =
                taComputedStyle.getPropertyValue("box-sizing") ===
                  "border-box" ||
                taComputedStyle.getPropertyValue("-moz-box-sizing") ===
                  "border-box" ||
                taComputedStyle.getPropertyValue("-webkit-box-sizing") ===
                  "border-box";
              boxOuter = !borderBox
                ? { width: 0, height: 0 }
                : {
                    width:
                      parseInt(
                        taComputedStyle.getPropertyValue("border-right-width"),
                        10
                      ) +
                      parseInt(
                        taComputedStyle.getPropertyValue("padding-right"),
                        10
                      ) +
                      parseInt(
                        taComputedStyle.getPropertyValue("padding-left"),
                        10
                      ) +
                      parseInt(
                        taComputedStyle.getPropertyValue("border-left-width"),
                        10
                      ),
                    height:
                      parseInt(
                        taComputedStyle.getPropertyValue("border-top-width"),
                        10
                      ) +
                      parseInt(
                        taComputedStyle.getPropertyValue("padding-top"),
                        10
                      ) +
                      parseInt(
                        taComputedStyle.getPropertyValue("padding-bottom"),
                        10
                      ) +
                      parseInt(
                        taComputedStyle.getPropertyValue("border-bottom-width"),
                        10
                      )
                  };
              minHeightValue = parseInt(
                taStyle.getPropertyValue("min-height"),
                10
              );
              heightValue = parseInt(
                taComputedStyle.getPropertyValue("height"),
                10
              );
              minHeight =
                Math.max(minHeightValue, heightValue) - boxOuter.height;

              // ensure getComputedStyle has returned a readable 'used value' pixel width
              if (
                taComputedStyleWidth.substr(
                  taComputedStyleWidth.length - 2,
                  2
                ) === "px"
              ) {
                // update mirror width in case the textarea width has changed
                width = parseInt(taComputedStyleWidth, 10) - boxOuter.width;
                mirror.style.width = width + "px";
              }

              mirrorHeight = mirror.scrollHeight;

              if (mirrorHeight > maxHeight) {
                mirrorHeight = maxHeight;
                overflow = "scroll";
              } else if (mirrorHeight < minHeight) {
                mirrorHeight = minHeight;
              }
              mirrorHeight += boxOuter.height;
              ta.style.overflowY = overflow || "hidden";

              if (taHeight !== mirrorHeight) {
                scope.$emit("elastic:resize", $ta, taHeight, mirrorHeight);
                ta.style.height = mirrorHeight + "px";
              }

              // small delay to prevent an infinite loop
              $timeout(
                function() {
                  active = false;
                },
                1,
                false
              );
            }
          }

          function forceAdjust() {
            active = false;
            adjust();
          }

          /*
           * initialise
           */

          // listen
          if ("onpropertychange" in ta && "oninput" in ta) {
            // IE9
            ta["oninput"] = ta.onkeyup = adjust;
          } else {
            ta["oninput"] = adjust;
          }

          $win.bind("resize", forceAdjust);

          scope.$watch(
            function() {
              return ngModel.$modelValue;
            },
            function(newValue) {
              if (!newValue) {
                return;
              }

              if (mirror.parentNode !== document.body) {
                angular.element(document.body).append(mirror);
              }

              forceAdjust();
            }
          );

          scope.$on("elastic:adjust", function() {
            initMirror();
            forceAdjust();
          });

          /*
           * destroy
           */
          scope.$on("$destroy", function() {
            $mirror.remove();
            $win.unbind("resize", forceAdjust);
          });
        }
      };
    }
  ]);
