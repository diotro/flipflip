import IncomingMessage = Electron.IncomingMessage;
import * as React from 'react';
import request from 'request';
import fs from "fs";
import gifInfo from 'gif-info';
import IdleTimer from 'react-idle-timer';

import {GO, HTF, IF, OF, SL, TF, VO, VTF, WF} from '../../data/const';
import {getRandomListItem, isVideo, urlToPath} from '../../data/utils';
import Config from "../../data/Config";
import Scene from "../../data/Scene";
import ChildCallbackHack from './ChildCallbackHack';
import ImageView from './ImageView';
import Strobe from "./Strobe";
import {webFrame} from "electron";

class GifInfo {
  animated: boolean;
  duration: string;
}

export default class ImagePlayer extends React.Component {
  readonly props: {
    config: Config,
    scene: Scene,
    advanceHack?: ChildCallbackHack,
    deleteHack?: ChildCallbackHack,
    maxInMemory: number,
    maxLoadingAtOnce: number,
    maxToRememberInHistory: number,
    allURLs: Map<string, Array<string>>,
    strobeLayer?: string,
    isPlaying: boolean,
    historyOffset: number,
    hasStarted: boolean,
    setHistoryPaths(historyPaths: Array<any>): void,
    setHistoryOffset(historyOffset: number): void,
    onLoaded(): void,
    setVideo(video: HTMLVideoElement): void,
    cache(i: HTMLImageElement | HTMLVideoElement): void,
    setTimeToNextFrame?(timeToNextFrame: number): void,
  };

  readonly state = {
    readyToDisplay: Array<HTMLImageElement | HTMLVideoElement>(),
    historyPaths: Array<HTMLImageElement | HTMLVideoElement>(),
    timeToNextFrame: 0,
    timeoutID: 0,
    nextImageID: 0,
    hideCursor: false,
    orderFunction: this.props.scene.orderFunction,
  };

  readonly idleTimerRef: React.RefObject<HTMLDivElement> = React.createRef();
  _isMounted: boolean;
  _isLooping: boolean;
  _loadedURLs: Array<string>;
  _nextIndex: number;
  _nextAdvIndex: number;
  _count: number;
  _nextSourceIndex: Map<string, number>;
  _timeout: NodeJS.Timeout;
  _waitTimeouts: Array<NodeJS.Timeout>;
  _toggleStrobe: boolean;

  render() {
    let offset = this.props.historyOffset;
    if (offset <= -this.state.historyPaths.length) {
      offset = -this.state.historyPaths.length + 1;
    }

    return (
      <div className="ImagePlayer"
           style={{cursor: this.state.hideCursor ? "none" : "initial"}}
           ref={this.idleTimerRef}>
        {(this.props.strobeLayer == SL.middle) && (
          <Strobe
            toggleStrobe={this._toggleStrobe}
            timeToNextFrame={this.state.timeToNextFrame}
            scene={this.props.scene}/>
        )}
        <IdleTimer
          ref={ref => {return this.idleTimerRef}}
          onActive={this.onActive.bind(this)}
          onIdle={this.onIdle.bind(this)}
          timeout={2000} />
        <ImageView
          image={this.state.historyPaths.length > 0 ? this.state.historyPaths[(this.state.historyPaths.length - 1) + offset] : null}
          scene={this.props.scene}
          timeToNextFrame={this.state.timeToNextFrame}
          toggleStrobe={this._toggleStrobe}
          fitParent={this.props.scene.gridView}
          hasStarted={this.props.hasStarted}
          onLoaded={this.state.historyPaths.length == 1 ? this.props.onLoaded : this.nop}
          setVideo={this.props.setVideo}/>
      </div>
    );
  }

  nop() {}

  componentDidMount() {
    this._isMounted = true;
    this._isLooping = false;
    this._loadedURLs = new Array<string>();
    this._nextIndex = 0;
    this._nextAdvIndex = 0;
    this._count = 0;
    this._nextSourceIndex = new Map<string, number>();
    this._waitTimeouts = new Array<NodeJS.Timeout>(this.props.config.displaySettings.maxLoadingAtOnce).fill(null);
    this._toggleStrobe = false;
    if (this.props.advanceHack) {
      this.props.advanceHack.listener = () => {
        clearTimeout(this._timeout);
        this.advance(true, true);
      }
    }
    if (this.props.deleteHack) {
      this.props.deleteHack.listener = () => {
        // delete current image from historyPaths and readyToDisplay
        this.delete();
      }
    }
    this.startFetchLoops(this.props.maxLoadingAtOnce);
    this.start();
  }

  componentWillUnmount() {
    this._isMounted = null;
    this._isLooping = null;
    this._loadedURLs = null;
    this._nextIndex = null;
    this._nextAdvIndex = null;
    this._count = null;
    this._nextSourceIndex = null;
    this._toggleStrobe = null;
    clearTimeout(this._timeout);
    for (let timeout of this._waitTimeouts) {
      clearTimeout(this._timeout);
    }
    this._timeout = null;
    this._waitTimeouts = null;
    if (this.props.advanceHack) {
      this.props.advanceHack.listener = null;
    }
    if (this.props.deleteHack) {
      this.props.deleteHack.listener = null;
    }
  }

  shouldComponentUpdate(props: any, state: any): boolean {
    return (state.hideCursor !== this.state.hideCursor ||
            state.historyPaths !== this.state.historyPaths ||
            props.scene !== this.props.scene ||
            props.isPlaying !== this.props.isPlaying ||
            props.hasStarted !== this.props.hasStarted ||
            props.allURLs !== this.props.allURLs ||
            props.historyOffset !== this.props.historyOffset ||
            props.strobeLayer !== this.props.strobeLayer);
  }

  componentDidUpdate(props: any, state: any) {
    if (((!props.isPlaying && this.props.isPlaying) ||
      (!props.allURLs && this.props.allURLs) ||
      (!props.hasStarted && this.props.hasStarted)) && !this._isLooping) {
      this.start();
    } else if (!this.props.isPlaying) {
      this._isLooping = false;
      clearTimeout(this._timeout);
    }
    if (this.props.scene.orderFunction !== this.state.orderFunction) {
      this.setState({readyToDisplay: [], orderFunction: this.props.scene.orderFunction});
    }

    if (this._count % this.props.config.displaySettings.maxInMemory == 0) {
      //printMemoryReport();
      webFrame.clearCache();
      //setTimeout(printMemoryReport, 1000);
    }
  }

  onActive() {
    this.setState({hideCursor: false})
  }

  onIdle() {
    this.setState({hideCursor: true})
  }

  delete() {
    const img = this.state.historyPaths[(this.state.historyPaths.length - 1) + this.props.historyOffset];
    const url = img.src;
    let newHistoryPaths = [];
    let newHistoryOffset = this.props.historyOffset;
    for (let image of this.state.historyPaths) {
      if (image.src != url) {
        newHistoryPaths.push(image);
      } else {
        newHistoryOffset += 1;
      }
    }
    if (newHistoryOffset > 0) {
      newHistoryOffset = 0;
    }
    this.props.setHistoryPaths(newHistoryPaths);
    this.props.setHistoryOffset(newHistoryOffset);
    this.setState({
      historyPaths: newHistoryPaths,
      historyOffset: newHistoryOffset,
      readyToDisplay: this.state.readyToDisplay.filter((i) => i.src != url),
    });
  }

  start() {
    if (this.props.allURLs == null) {
      return;
    }

    this.advance(true, true);
  }

  startFetchLoops(max: number, loop = 0) {
    if (loop < max) {
      this.runFetchLoop(loop);
      // Put a small delay between our loops
      this._waitTimeouts[loop] = setTimeout(this.startFetchLoops.bind(this, max, loop+1), 10);
    }
  }

  runFetchLoop(i: number) {
    if (!this._isMounted) return;

    if (this.state.readyToDisplay.length >= this.props.maxLoadingAtOnce || !this.props.allURLs) {
      // Wait for the display loop to use an image
      this._waitTimeouts[i] = setTimeout(() => this.runFetchLoop(i), 100);
      return;
    }

    let source;
    let collection;
    let url: string;
    let urlIndex: number;
    let sourceLength: number;

    // For source weighted
    if (this.props.scene.weightFunction == WF.sources) {

      // If sorting randomly, get a random source
      if (this.props.scene.orderFunction == OF.random) {
        source = getRandomListItem(Array.from(this.props.allURLs.keys()));
      } else { // Else get the next source
        source = Array.from(this.props.allURLs.keys())[this._nextIndex++%this.props.allURLs.size];
      }
      // Get the urls from the source
      collection = this.props.allURLs.get(source);

      // If we have no urls, loop again
      if (!(collection && collection.length)) {
        this.runFetchLoop(i);
        return;
      }

      // If sorting randomly and forcing all
      if (this.props.scene.orderFunction == OF.random && this.props.scene.forceAll) {
        // Filter the available urls to those not played yet
        collection = collection.filter((u) => !this._loadedURLs.includes(u));
        // If there are no remaining urls for this source
        if (!(collection && collection.length)) {
          // Make sure all the other sources are also extinguished
          const remainingLibrary = [].concat.apply([], Array.from(this.props.allURLs.values())).filter((u: string) => !this._loadedURLs.includes(u));
          // If they are, clear loadedURLs
          if (remainingLibrary.length === 0) {
            this._loadedURLs = new Array<string>();
            collection = this.props.allURLs.get(source);
          } else { // Else loop again
            this.runFetchLoop(i);
            return;
          }
        }
      }

      // If sorting randomly, get a random URL
      if (this.props.scene.orderFunction == OF.random) {
        url = getRandomListItem(collection);
      } else { // Else get the next index for this source
        let index = this._nextSourceIndex.get(source);
        if (!index) {
          if (this._nextSourceIndex.size > 0) {
            index = Math.min(...this._nextSourceIndex.values());
          } else {
            index = 0;
          }
        }
        if (this.props.scene.orderFunction == OF.strict) {
          urlIndex = index;
          sourceLength = collection.length;
        }
        url = collection[index%collection.length];
        this._nextSourceIndex.set(source, index+1)
      }
    } else { // For image weighted

      // Concat all images together
      collection = [].concat.apply([], Array.from(this.props.allURLs.keys()));
      // If there are none, loop again1
      if (!(collection && collection.length)) {
        this.runFetchLoop(i);
        return;
      }

      // If sorting randomly and forcing all
      if (this.props.scene.orderFunction == OF.random && this.props.scene.forceAll) {
        // Filter the available ulls to those not played yet
        collection = collection.filter((u: string) => !this._loadedURLs.includes(u));
        // If there are no remaining urls, clear loadedURLs
        if (!(collection && collection.length)) {
          this._loadedURLs = new Array<string>();
          collection = [].concat.apply([], Array.from(this.props.allURLs.keys()));
        }
      }

      // If sorting randomly, get a random URL
      if (this.props.scene.orderFunction == OF.random) {
        url = getRandomListItem(collection);
      } else { // Else get the next index
        if (this.props.scene.orderFunction == OF.strict) {
          urlIndex = this._nextIndex;
          sourceLength = collection.length;
        }
        url = collection[this._nextIndex++%collection.length];
      }

      // Get the source of this image from the map
      source = this.props.allURLs.get(url)[0];
    }

    if (this.props.scene.orderFunction == OF.random && this.props.scene.forceAll) {
      this._loadedURLs.push(url);
    }

    if (isVideo(url, false)) {
      let video = document.createElement('video');
      video.setAttribute("source", source);
      if (this.props.scene.orderFunction == OF.strict) {
        video.setAttribute("index", urlIndex.toString());
        video.setAttribute("length", sourceLength.toString());
      }
      let clipRegex = /(.*):::(\d+):(\d+)$/g.exec(url);
      if (clipRegex != null) {
        url = clipRegex[1];
        video.setAttribute("start", clipRegex[2]);
        video.setAttribute("end", clipRegex[3]);
      }

      const successCallback = () => {
        if (!this._isMounted) return;
        this.props.cache(video);

        if (!video.hasAttribute("start") && !video.hasAttribute("end") &&
          (this.props.scene.skipVideoStart > 0 || this.props.scene.skipVideoEnd > 0) &&
          (video.duration - (this.props.scene.skipVideoStart / 1000) - (this.props.scene.skipVideoEnd / 1000)) > 0) {
          video.setAttribute("start", (this.props.scene.skipVideoStart / 1000).toString());
          video.setAttribute("end", (video.duration - (this.props.scene.skipVideoEnd / 1000)).toString());
        }

        if (this.props.scene.videoOption == VO.full) {
          let duration;
          if (video.hasAttribute("start") && video.hasAttribute("end")) {
            const start = parseInt(video.getAttribute("start"), 10);
            const end = parseInt(video.getAttribute("end"), 10);
            duration = end - start;
          } else {
            duration = video.duration;
          }
          video.setAttribute("duration", (duration * 1000).toString());
        } else if (this.props.scene.videoOption == VO.part) {
          video.setAttribute("duration", this.props.scene.videoTimingConstant.toString());
        }

        if (video.hasAttribute("start") && video.hasAttribute("end")) {
          const start = parseInt(video.getAttribute("start"), 10);
          const end = parseInt(video.getAttribute("end"), 10);
          if (this.props.scene.videoOption != VO.full && this.props.scene.randomVideoStart && (!this.props.scene.continueVideo || !video.currentTime)) {
            video.currentTime = start + (Math.random() * (end - start));
          } else if (video.currentTime < start || video.currentTime > end) {
            video.currentTime = parseInt(video.getAttribute("start"), 10);
          }
        } else if (this.props.scene.videoOption != VO.full && this.props.scene.randomVideoStart && (!this.props.scene.continueVideo || !video.currentTime)) {
          video.currentTime = Math.random() * video.duration;
        }

        (video as any).key = this.state.nextImageID;
        this.setState({
          readyToDisplay: this.state.readyToDisplay.concat([video]),
          nextImageID: this.state.nextImageID + 1,
        });
        if (this.state.historyPaths.length === 0) {
          this.advance(false, false);
        }
        this.runFetchLoop(i);
      };

      const errorCallback = () => {
        if (!this._isMounted) return;
        this.runFetchLoop(i);
      };

      if (this.props.scene.continueVideo) {
        const videoFind = this.state.historyPaths.find((i) => i.src == url &&
          i.getAttribute("start") == video.getAttribute("start") &&
          i.getAttribute("end") == video.getAttribute("end"));
        if (videoFind) {
          video = (videoFind as HTMLVideoElement);
          successCallback();
          return;
        }
      }

      video.onloadeddata = () => {
        // images may load immediately, but that messes up the setState()
        // lifecycle, so always load on the next event loop iteration.
        // Also, now  we know the image size, so we can finally filter it.
        if (video.videoWidth < this.props.config.displaySettings.minVideoSize
          || video.videoHeight < this.props.config.displaySettings.minVideoSize) {
          errorCallback();
        } else {
          successCallback();
        }
      };

      video.onerror = () => {
        errorCallback();
      };

      video.src = url;
      video.preload = "auto";
      video.loop = true;
      video.load();
    } else {
      const img = new Image();
      img.setAttribute("source", source);
      if (this.props.scene.orderFunction == OF.strict) {
        img.setAttribute("index", urlIndex.toString());
        img.setAttribute("length", sourceLength.toString());
      }

      const successCallback = () => {
        if (!this._isMounted) return;
        this.props.cache(img);
        (img as any).key = this.state.nextImageID;
        this.setState({
          readyToDisplay: this.state.readyToDisplay.concat([img]),
          nextImageID: this.state.nextImageID + 1,
        });
        if (this.state.historyPaths.length === 0) {
          this.advance(false, false);
        }
        this.runFetchLoop(i);
      };

      const errorCallback = () => {
        if (!this._isMounted) return;
        this.runFetchLoop(i);
      };

      function toArrayBuffer(buf: Buffer) {
        let ab = new ArrayBuffer(buf.length);
        let view = new Uint8Array(ab);
        for (let j = 0; j < buf.length; ++j) {
          view[j] = buf[j];
        }
        return ab;
      }

      img.onload = () => {
        // images may load immediately, but that messes up the setState()
        // lifecycle, so always load on the next event loop iteration.
        // Also, now  we know the image size, so we can finally filter it.
        if (img.width < this.props.config.displaySettings.minImageSize
          || img.height < this.props.config.displaySettings.minImageSize) {
          errorCallback();
        } else {
          successCallback();
        }
      };

      img.onerror = () => {
        errorCallback();
      };

      const processInfo = (info: GifInfo) => {
        // If gif is animated and we want to play entire length, store its duration
        if (info && info.animated) {
          if (this.props.scene.gifOption == GO.full) {
            img.setAttribute("duration", info.duration);
          } else if (this.props.scene.gifOption == GO.part ) {
            img.setAttribute("duration", this.props.scene.gifTimingConstant.toString());
          }
        }

        // Exclude non-animated gifs from gifs
        if (this.props.scene.imageTypeFilter == IF.gifs && info && !info.animated) {
          this.runFetchLoop(i);
          return;
          // Exclude animated gifs from stills
        } else if (this.props.scene.imageTypeFilter == IF.stills && info && info.animated) {
          this.runFetchLoop(i);
          return;
        }

        img.src = url;
      };

      // Get gifinfo if we need for imageFilter or playing full gif
      if ((this.props.scene.imageTypeFilter == IF.gifs || this.props.scene.imageTypeFilter == IF.stills || this.props.scene.gifOption != GO.none) && url.toLocaleLowerCase().endsWith('.gif')) {
        // Get gif info. See https://github.com/Prinzhorn/gif-info
        try {
          if (url.includes("file://")) {
            processInfo(gifInfo(toArrayBuffer(fs.readFileSync(urlToPath(url)))));
          } else {
            request.get({url, encoding: null}, function (err: Error, res: IncomingMessage, body: Buffer) {
              if (err) {
                console.error(err);
                return;
              }
              processInfo(gifInfo(toArrayBuffer(body)));
            });
          }
        } catch (e) {
          console.error(e);
        }
      } else {
        img.src = url;
      }
    }
  }

  advance(force = false, schedule = true) {
    // bail if dead
    if (!(force || (this.props.isPlaying && this._isMounted && (this.props.hasStarted || this.state.historyPaths.length == 0)))) {
      this._isLooping = false;
      return;
    }
    this._isLooping = true;
    this._count++;

    let nextHistoryPaths = this.state.historyPaths;
    let nextImg: HTMLImageElement | HTMLVideoElement;
    if (this.props.scene.orderFunction == OF.strict) {
      this.state.readyToDisplay.sort((a, b) => {
        // JavaScript doesn't calculate negative modulos correctly, use this
        const mod = (x: number, n: number) => (x % n + n) % n;
        const aStrict = mod((parseInt(a.getAttribute("index"), 10) - this.state.historyPaths.length), parseInt(a.getAttribute("length"), 10));
        const bStrict = mod((parseInt(b.getAttribute("index"), 10) - this.state.historyPaths.length), parseInt(b.getAttribute("length"), 10));
        if (aStrict > bStrict) {
          return 1;
        } else if (aStrict < bStrict) {
          return -1;
        } else {
          return 0;
        }
      });
    }
    if (this.state.readyToDisplay.length) {
      // If there is an image ready, display the next image
      nextImg = this.state.readyToDisplay.shift();
    } else if (this.state.historyPaths.length && this.props.config.defaultScene.orderFunction == OF.random && !this.props.scene.forceAll) {
      // If no image is ready, we have a history to choose from, ordering is random, and NOT forcing all
      // Choose a random image from history to display
      nextImg = getRandomListItem(this.state.historyPaths);
    } else if (this.state.historyPaths.length) {
      // If no image is ready, we have a history to choose from, and ordering is not random
      // Show the next image from history
      nextImg = this.state.historyPaths[this._nextAdvIndex++%this.state.historyPaths.length];
    }

    if (nextImg) {
      nextHistoryPaths = nextHistoryPaths.concat([nextImg]);
    }

    while (nextHistoryPaths.length > this.props.maxInMemory) {
      nextHistoryPaths.shift();
    }

    if (!schedule) {
      this.setState({
        historyPaths: nextHistoryPaths,
      });
      this.props.setHistoryPaths(nextHistoryPaths);
    } else {
      let timeToNextFrame: number = 0;
      switch (this.props.scene.timingFunction) {
        case TF.random:
          timeToNextFrame = Math.floor(Math.random() * (this.props.scene.timingMax - this.props.scene.timingMin + 1)) + this.props.scene.timingMin;
          break;
        case TF.sin:
          const sinRate = (Math.abs(this.props.scene.timingSinRate - 100) + 2) * 1000;
          timeToNextFrame = Math.floor(Math.abs(Math.sin(Date.now() / sinRate)) * (this.props.scene.timingMax - this.props.scene.timingMin + 1)) + this.props.scene.timingMin;
          break;
        case TF.constant:
          timeToNextFrame = this.props.scene.timingConstant;
          // If we cannot parse this, default to 1s
          if (!timeToNextFrame && timeToNextFrame != 0) {
            timeToNextFrame = 1000;
          }
          break;
        case TF.bpm:
          const bpmMulti = this.props.scene.timingBPMMulti > 0 ? this.props.scene.timingBPMMulti : 1 / (-1 * (this.props.scene.timingBPMMulti - 2));
          timeToNextFrame = 60000 / (this.props.scene.bpm * bpmMulti);
          // If we cannot parse this, default to 1s
          if (!timeToNextFrame) {
            timeToNextFrame = 1000;
          }
          break;
      }
      if (nextImg && nextImg.getAttribute("duration") && timeToNextFrame < parseInt(nextImg.getAttribute("duration"))) {
        timeToNextFrame = parseInt(nextImg.getAttribute("duration"));
      }
      if (this.props.setTimeToNextFrame) {
        this.props.setTimeToNextFrame(timeToNextFrame);
      }
      this._toggleStrobe = !this._toggleStrobe;
      this.props.setHistoryPaths(nextHistoryPaths);
      this.setState({
        historyPaths: nextHistoryPaths,
        timeToNextFrame,
      });
      this._timeout = setTimeout(this.advance.bind(this, false, true), timeToNextFrame);
    }
  }
};
