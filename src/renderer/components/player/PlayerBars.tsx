import * as React from "react";
import {clipboard, nativeImage, remote} from "electron";
const {getCurrentWindow, Menu, MenuItem, app} = remote;
import clsx from "clsx";
import fileURL from "file-url";
import fs from "fs";

import {
  AppBar, Button, Card, CardActionArea, CardContent, createStyles, Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle, Divider, Drawer, ExpansionPanel, ExpansionPanelDetails, ExpansionPanelSummary,
  IconButton, Link, Theme, Toolbar, Tooltip, Typography, withStyles
} from "@material-ui/core";

import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ForwardIcon from '@material-ui/icons/Forward';
import FullscreenIcon from '@material-ui/icons/Fullscreen';
import PauseIcon from '@material-ui/icons/Pause';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';

import {createMainMenu, createMenuTemplate} from "../../../main/MainMenu";
import {IF, PT, ST} from "../../data/const";
import {getCachePath, getSourceType, urlToPath} from "../../data/utils";
import Config from "../../data/Config";
import LibrarySource from "../../data/LibrarySource";
import Scene from "../../data/Scene";
import Tag from "../../data/Tag";
import ChildCallbackHack from "./ChildCallbackHack";
import SceneOptionCard from "../configGroups/SceneOptionCard";
import ImageVideoCard from "../configGroups/ImageVideoCard";
import ZoomMoveCard from "../configGroups/ZoomMoveCard";
import CrossFadeCard from "../configGroups/CrossFadeCard";
import StrobeCard from "../configGroups/StrobeCard";
import AudioCard from "../configGroups/AudioCard";
import TextCard from "../configGroups/TextCard";
import VideoCard from "../configGroups/VideoCard";

const drawerWidth = 340;

const styles = (theme: Theme) => createStyles({
  hoverBar: {
    zIndex: theme.zIndex.drawer + 1,
    position: 'absolute',
    opacity: 0,
    height: theme.spacing(5),
    width: '100%',
    ... theme.mixins.toolbar,
  },
  appBar: {
    zIndex: theme.zIndex.drawer + 1,
    height: theme.spacing(8),
    marginTop: -theme.spacing(8) - 3,
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },
  appBarHover: {
    marginTop: 0,
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
  title: {
    textAlign: 'center',
    flexGrow: 1,
  },
  headerBar: {
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    flexWrap: 'nowrap',
  },
  headerLeft: {
    flexBasis: '20%',
  },
  headerRight: {
    flexBasis: '20%',
    justifyContent: 'flex-end',
    display: 'flex',
  },
  drawerToolbar: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.palette.background.default,
    ...theme.mixins.toolbar,
  },
  drawer: {
    zIndex: theme.zIndex.drawer,
    width: drawerWidth,
    marginLeft: -drawerWidth - 3,
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },
  drawerHover: {
    marginLeft: 0,
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
  hoverDrawer: {
    zIndex: theme.zIndex.drawer,
    position: 'absolute',
    opacity: 0,
    width: theme.spacing(5),
    height: '100%',
  },
  drawerPaper: {
    position: 'relative',
    whiteSpace: 'nowrap',
    overflowX: 'hidden',
    height: '100vh',
    width: 0,
    backgroundColor: theme.palette.background.default,
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
  drawerPaperHover: {
    width: drawerWidth,
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },
  tagDrawer: {
    zIndex: theme.zIndex.drawer + 1,
    position: 'absolute',
  },
  tagDrawerPaper: {
    transform: 'scale(0)',
    transformOrigin: 'bottom left',
    backgroundColor: theme.palette.background.default,
    transition: theme.transitions.create('transform', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
  tagDrawerPaperHover: {
    transform: 'scale(1)',
    transition: theme.transitions.create('transform', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
  },
  hoverTagDrawer: {
    zIndex: theme.zIndex.drawer + 1,
    position: 'absolute',
    bottom: 0,
    opacity: 0,
    width: '100%',
    height: theme.spacing(5),
  },
  tagList: {
    padding: theme.spacing(1),
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  tag: {
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  tagContent: {
    padding: theme.spacing(1),
  },
  selectedTag: {
    backgroundColor: theme.palette.primary.light,
    color: theme.palette.primary.contrastText,
  },
  wordWrap: {
    wordWrap: 'break-word',
  },
  backdropTop: {
    zIndex: theme.zIndex.modal + 1,
  },
  highlight: {
    borderWidth: 2,
    borderColor: theme.palette.secondary.main,
    borderStyle: 'solid',
  },
  disable: {
    pointerEvents: 'none',
  }
});

class PlayerBars extends React.Component {
  readonly props: {
    classes: any,
    config: Config,
    hasStarted: boolean,
    historyPaths: Array<any>,
    historyOffset: number,
    imagePlayerAdvanceHack: ChildCallbackHack,
    imagePlayerDeleteHack: ChildCallbackHack,
    isEmpty: boolean,
    isPlaying: boolean,
    mainVideo: HTMLVideoElement,
    overlayVideos: Array<HTMLVideoElement>,
    scene: Scene,
    scenes: Array<Scene>,
    title: string,
    tutorial: string,
    goBack(): void,
    historyBack(): void,
    historyForward(): void,
    navigateTagging(offset: number): void,
    onUpdateScene(scene: Scene, fn: (scene: Scene) => void): void,
    play(): void,
    pause(): void,
    allTags?: Array<Tag>,
    tags?: Array<Tag>,
    blacklistFile?(sourceURL: string, fileToBlacklist: string): void,
    goToTagSource?(source: LibrarySource): void,
    toggleTag?(sourceID: number, tag: Tag): void,
  };

  readonly state = {
    appBarHover: false,
    drawerHover: false,
    tagDrawerHover: false,
    blacklistSource: null as LibrarySource,
    blacklistFile: null as string,
    deletePath: null as string,
    deleteError: null as string,
  };

  _interval: NodeJS.Timer = null;
  _appBarTimeout: any = null;
  _drawerTimeout: any = null;
  _tagDrawerTimeout: any = null;

  render() {
    const classes = this.props.classes;

    const canGoBack = this.props.historyOffset > -(this.props.historyPaths.length - 1);
    const canGoForward = this.props.historyOffset < 0;
    const tagNames = this.props.tags ? this.props.tags.map((t) => t.name) : [];

    return(
      <React.Fragment>
        <div
          className={classes.hoverBar}
          onMouseEnter={this.onMouseEnterAppBar.bind(this)}
          onMouseLeave={this.onMouseLeaveAppBar.bind(this)}/>

        <AppBar
          position="absolute"
          onMouseEnter={this.onMouseEnterAppBar.bind(this)}
          onMouseLeave={this.onMouseLeaveAppBar.bind(this)}
          className={clsx(classes.appBar, (this.props.tutorial == PT.toolbar || !this.props.hasStarted || this.props.isEmpty || this.state.appBarHover) && classes.appBarHover, this.props.tutorial == PT.toolbar && clsx(classes.backdropTop, classes.highlight))}>
          <Toolbar className={classes.headerBar}>
            <div className={classes.headerLeft}>
              <Tooltip title="Back" placement="right-end">
                <IconButton
                  edge="start"
                  color="inherit"
                  aria-label="Back"
                  onClick={this.props.goBack.bind(this)}>
                  <ArrowBackIcon />
                </IconButton>
              </Tooltip>
            </div>

            <Typography component="h1" variant="h4" color="inherit" noWrap className={classes.title}>
              {this.props.title}
            </Typography>

            <div className={classes.headerRight}>
              <Tooltip title="Toggle Fullscreen">
                <IconButton
                  edge="start"
                  color="inherit"
                  aria-label="FullScreen"
                  onClick={this.toggleFull.bind(this)}>
                  <FullscreenIcon fontSize="large"/>
                </IconButton>
              </Tooltip>
              <Divider component="div" orientation="vertical" style={{height: 48, margin: '0 14px 0 3px'}}/>
              <IconButton
                disabled={!canGoBack}
                edge="start"
                color="inherit"
                aria-label="Backward"
                onClick={this.historyBack.bind(this)}>
                <ForwardIcon fontSize="large" style={{transform: 'rotate(180deg)'}}/>
              </IconButton>
              <IconButton
                edge="start"
                color="inherit"
                aria-label={this.props.isPlaying ? "Pause" : "Play"}
                onClick={this.setPlayPause.bind(this, !this.props.isPlaying)}>
                {this.props.isPlaying ? <PauseIcon fontSize="large"/> : <PlayArrowIcon fontSize="large"/>}
              </IconButton>
              <IconButton
                disabled={!canGoForward}
                edge="start"
                color="inherit"
                aria-label="Forward"
                onClick={this.historyForward.bind(this)}>
                <ForwardIcon fontSize="large"/>
              </IconButton>
            </div>
          </Toolbar>
        </AppBar>

        {this.props.hasStarted && !this.props.isEmpty && (
          <React.Fragment>
            <div
              className={classes.hoverDrawer}
              onMouseEnter={this.onMouseEnterDrawer.bind(this)}
              onMouseLeave={this.onMouseLeaveDrawer.bind(this)}/>

            <Drawer
              variant="permanent"
              className={clsx(classes.drawer, (this.props.tutorial == PT.sidebar || this.state.drawerHover) && classes.drawerHover)}
              classes={{paper: clsx(classes.drawerPaper, (this.props.tutorial == PT.sidebar || this.state.drawerHover) && classes.drawerPaperHover, this.props.tutorial == PT.toolbar && clsx(classes.backdropTop, classes.highlight))}}
              open={this.props.tutorial == PT.sidebar || this.state.drawerHover}
              onMouseEnter={this.onMouseEnterDrawer.bind(this)}
              onMouseLeave={this.onMouseLeaveDrawer.bind(this)}>
              <div className={classes.drawerToolbar}>
                <Typography variant="h4">
                  Settings
                </Typography>
              </div>

              {this.props.scene.imageTypeFilter != IF.stills && (
                <ExpansionPanel TransitionProps={{ unmountOnExit: true }}>
                  <ExpansionPanelSummary
                    expandIcon={<ExpandMoreIcon />}
                  >
                    <Typography>Video Controls</Typography>
                  </ExpansionPanelSummary>
                  <ExpansionPanelDetails>
                    <VideoCard
                      scene={this.props.scene}
                      otherScenes={this.props.scene.overlays.map((o) => this.getScene(o.sceneID))}
                      isPlaying={this.props.isPlaying}
                      mainVideo={this.props.mainVideo}
                      otherVideos={this.props.overlayVideos}
                      onUpdateScene={this.props.onUpdateScene.bind(this)}/>
                  </ExpansionPanelDetails>
                </ExpansionPanel>
              )}

              <ExpansionPanel TransitionProps={{ unmountOnExit: true }}>
                <ExpansionPanelSummary
                  expandIcon={<ExpandMoreIcon />}
                >
                  <Typography>Scene Options</Typography>
                </ExpansionPanelSummary>
                <ExpansionPanelDetails>
                  <SceneOptionCard
                    sidebar
                    allScenes={this.props.scenes}
                    isTagging={this.props.tags != null}
                    scene={this.props.scene}
                    onUpdateScene={this.props.onUpdateScene.bind(this)}/>
                </ExpansionPanelDetails>
              </ExpansionPanel>

              <ExpansionPanel TransitionProps={{ unmountOnExit: true }}>
                <ExpansionPanelSummary
                  expandIcon={<ExpandMoreIcon />}
                >
                  <Typography>Image/Video Options</Typography>
                </ExpansionPanelSummary>
                <ExpansionPanelDetails>
                  <ImageVideoCard
                    sidebar
                    isPlayer
                    scene={this.props.scene}
                    onUpdateScene={this.props.onUpdateScene.bind(this)}/>
                </ExpansionPanelDetails>
              </ExpansionPanel>

              <ExpansionPanel TransitionProps={{ unmountOnExit: true }}>
                <ExpansionPanelSummary
                  expandIcon={<ExpandMoreIcon />}
                >
                  <Typography>Zoom/Move</Typography>
                </ExpansionPanelSummary>
                <ExpansionPanelDetails>
                  <ZoomMoveCard
                    sidebar
                    scene={this.props.scene}
                    onUpdateScene={this.props.onUpdateScene.bind(this)} />
                </ExpansionPanelDetails>
              </ExpansionPanel>

              <ExpansionPanel TransitionProps={{ unmountOnExit: true }}>
                <ExpansionPanelSummary
                  expandIcon={<ExpandMoreIcon />}
                >
                  <Typography>Cross-Fade</Typography>
                </ExpansionPanelSummary>
                <ExpansionPanelDetails>
                  <CrossFadeCard
                    sidebar
                    scene={this.props.scene}
                    onUpdateScene={this.props.onUpdateScene.bind(this)} />
                </ExpansionPanelDetails>
              </ExpansionPanel>

              <ExpansionPanel TransitionProps={{ unmountOnExit: true }}>
                <ExpansionPanelSummary
                  expandIcon={<ExpandMoreIcon />}
                >
                  <Typography>Strobe</Typography>
                </ExpansionPanelSummary>
                <ExpansionPanelDetails>
                  <StrobeCard
                    sidebar
                    scene={this.props.scene}
                    onUpdateScene={this.props.onUpdateScene.bind(this)} />
                </ExpansionPanelDetails>
              </ExpansionPanel>

              <ExpansionPanel TransitionProps={{ unmountOnExit: !this.props.scene.audioEnabled }}>
                <ExpansionPanelSummary
                  expandIcon={<ExpandMoreIcon />}
                >
                  <Typography>Audio Tracks</Typography>
                </ExpansionPanelSummary>
                <ExpansionPanelDetails>
                  <AudioCard
                    sidebar
                    scene={this.props.scene}
                    scenePaths={this.props.historyPaths}
                    startPlaying={true}
                    goBack={this.props.goBack.bind(this)}
                    onUpdateScene={this.props.onUpdateScene.bind(this)}/>
                </ExpansionPanelDetails>
              </ExpansionPanel>

              <ExpansionPanel TransitionProps={{ unmountOnExit: true }}>
                <ExpansionPanelSummary
                  expandIcon={<ExpandMoreIcon />}
                >
                  <Typography>Text Overlay</Typography>
                </ExpansionPanelSummary>
                <ExpansionPanelDetails>
                  <TextCard
                    sidebar
                    scene={this.props.scene}
                    onUpdateScene={this.props.onUpdateScene.bind(this)}/>
                </ExpansionPanelDetails>
              </ExpansionPanel>
            </Drawer>
          </React.Fragment>
        )}

        {this.props.hasStarted && this.props.allTags && (
          <React.Fragment>
            <div
              className={classes.hoverTagDrawer}
              onMouseEnter={this.onMouseEnterTagDrawer.bind(this)}
              onMouseLeave={this.onMouseLeaveTagDrawer.bind(this)}/>

            <Drawer
              variant="permanent"
              anchor="bottom"
              className={classes.tagDrawer}
              classes={{paper: clsx(classes.tagDrawerPaper, this.state.tagDrawerHover && classes.tagDrawerPaperHover)}}
              open={this.state.tagDrawerHover}
              onMouseEnter={this.onMouseEnterTagDrawer.bind(this)}
              onMouseLeave={this.onMouseLeaveTagDrawer.bind(this)}>
              <div className={classes.tagList}>
                {this.props.allTags.map((tag) =>
                  <Card className={clsx(classes.tag, tagNames && tagNames.includes(tag.name) && classes.selectedTag)} key={tag.id}>
                    <CardActionArea onClick={this.props.toggleTag.bind(this, this.props.scene.libraryID, tag)}>
                      <CardContent className={classes.tagContent}>
                        <Typography component="h6" variant="body2">
                          {tag.name}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                )}
              </div>

            </Drawer>
          </React.Fragment>
        )}

        <Dialog
          open={!!this.state.blacklistFile}
          onClose={this.onCloseDialog.bind(this)}
          aria-labelledby="blacklist-title"
          aria-describedby="blacklist-description">
          <DialogTitle id="blacklist-title">Blacklist File</DialogTitle>
          <DialogContent>
            <DialogContentText id="blacklist-description">
              Are you sure you want to blacklist <Link className={classes.wordWrap} href="#" onClick={this.openLink.bind(this, this.state.blacklistFile)}>{this.state.blacklistFile}</Link> ?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={this.onCloseDialog.bind(this)} color="secondary">
              Cancel
            </Button>
            <Button onClick={this.onFinishBlacklistFile.bind(this)} color="primary">
              Yes
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={!!this.state.deletePath}
          onClose={this.onCloseDialog.bind(this)}
          aria-labelledby="delete-title"
          aria-describedby="delete-description">
          <DialogTitle id="delete-title">Delete File</DialogTitle>
          <DialogContent>
            {this.state.deletePath && (
              <DialogContentText id="delete-description">
                Are you sure you want to delete <Link className={classes.wordWrap} href="#" onClick={this.openLink.bind(this, this.state.deletePath)}>{this.state.deletePath}</Link>
              </DialogContentText>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={this.onCloseDialog.bind(this)} color="secondary">
              Cancel
            </Button>
            <Button onClick={this.onFinishDeletePath.bind(this)} color="primary">
              Yes
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={!!this.state.deleteError}
          onClose={this.onCloseDialog.bind(this)}
          aria-describedby="delete-error-description">
          <DialogContent>
            <DialogContentText className={classes.wordWrap} id="delete-error-description">
              {this.state.deleteError}
            </DialogContentText>
          </DialogContent>
        </Dialog>
      </React.Fragment>
    );
  }

  componentDidMount() {
    this.setAlwaysOnTop(this.props.config.displaySettings.alwaysOnTop);
    this.setMenuBarVisibility(this.props.config.displaySettings.showMenu);
    this.setFullscreen(this.props.config.displaySettings.fullScreen);

    window.addEventListener('contextmenu', this.showContextMenu, false);
    window.addEventListener('keydown', this.onKeyDown, false);
    this.buildMenu();
  }

  componentWillUnmount() {
    clearInterval(this._interval);
    this._interval = null;
    clearTimeout(this._appBarTimeout);
    clearTimeout(this._drawerTimeout);
    clearTimeout(this._tagDrawerTimeout);
    this._appBarTimeout = null;
    this._drawerTimeout = null;
    this._tagDrawerTimeout = null;
    createMainMenu(Menu, createMenuTemplate(app));
    window.removeEventListener('contextmenu', this.showContextMenu);
    window.removeEventListener('keydown', this.onKeyDown);
  }

  getScene(id: number): Scene {
    return this.props.scenes.find((s) => s.id == id);
  }

  openLink(url: string) {
    remote.shell.openExternal(url);
  }

  onMouseEnterAppBar() {
    clearTimeout(this._appBarTimeout);
    this.setState({appBarHover: true});
  }

  closeAppBar() {
    this.setState({appBarHover: false});
  }

  onMouseLeaveAppBar() {
    clearTimeout(this._appBarTimeout);
    this._appBarTimeout = setTimeout(this.closeAppBar.bind(this), 1000);
  }

  onMouseEnterDrawer() {
    clearTimeout(this._drawerTimeout);
    this.setState({drawerHover: true});
  }

  closeDrawer() {
    this.setState({drawerHover: false});
  }

  onMouseLeaveDrawer() {
    clearTimeout(this._drawerTimeout);
    this._drawerTimeout = setTimeout(this.closeDrawer.bind(this), 1000);
  }

  onMouseEnterTagDrawer() {
    clearTimeout(this._tagDrawerTimeout);
    this.setState({tagDrawerHover: true});
  }

  closeTagDrawer() {
    this.setState({tagDrawerHover: false});
  }

  onMouseLeaveTagDrawer() {
    clearTimeout(this._tagDrawerTimeout);
    this._tagDrawerTimeout = setTimeout(this.closeTagDrawer.bind(this), 500);
  }

  onCloseDialog() {
    this.setState({blacklistSource: null, blacklistFile: null, deletePath: null, deleteError: null});
  }

  onBlacklistFile(source: string, fileToBlacklist: string) {
    this.setState({blacklistSource: source, blacklistFile: fileToBlacklist});
  }

  onFinishBlacklistFile(source: string, fileToBlacklist: string) {
    this.props.blacklistFile(source, fileToBlacklist);
    this.onCloseDialog();
  }

  onDeletePath(path: string) {
    if (fs.existsSync(path)) {
      this.setState({deletePath: path});
    } else {
      this.setState({deletePath: null, deleteError: "This file doesn't exist, cannot delete"});
    }
  }

  onFinishDeletePath() {
    fs.unlink(this.state.deletePath, (err) => {
      if (err) {
        this.setState({deletePath: null, deleteError: "An error ocurred while deleting the file: " + err.message});
        console.error(err);
      } else {
        this.props.imagePlayerDeleteHack.fire();
        this.onCloseDialog();
      }
    });
  }

  toggleFull() {
    this.setFullscreen(!getCurrentWindow().isFullScreen());
    this.setMenuBarVisibility(!getCurrentWindow().isFullScreen());
  }

  historyBack() {
    if (!this.state.drawerHover || document.activeElement.tagName.toLocaleLowerCase() != "input") {
      if (this.props.historyOffset > -(this.props.historyPaths.length - 1)) {
        this.props.historyBack();
      }
    }
  }

  historyForward() {
    if (!this.state.drawerHover || document.activeElement.tagName.toLocaleLowerCase() != "input") {
      if (this.props.historyOffset >= 0) {
        this.props.imagePlayerAdvanceHack.fire();
      } else {
        this.props.historyForward();
      }
    }
  }

  setMenuBarVisibility(showMenu: boolean) {
    this.props.config.displaySettings.showMenu = showMenu;
    this.buildMenu();
    getCurrentWindow().setMenuBarVisibility(showMenu);
  }

  setFullscreen(fullScreen: boolean) {
    this.props.config.displaySettings.fullScreen = fullScreen;
    this.buildMenu();
    getCurrentWindow().setFullScreen(fullScreen);
  }

  buildMenu() {
    if (this.props.tutorial != null) return;
    createMainMenu(Menu, createMenuTemplate(app, {
      label: 'Player controls',
      submenu: Array.from(this.getKeyMap().entries()).map(([k, v]) => {
        const [label, accelerator] = v;
        return {
          label,
          accelerator,
          click: (this as any)[k as any].bind(this),
        };
      })
    }));
  }

  showContextMenu = () => {
    if (this.props.tutorial != null) return;
    const contextMenu = new Menu();
    const img = this.props.historyPaths[(this.props.historyPaths.length - 1) + this.props.historyOffset];
    const url = img.src;
    let source = img.getAttribute("source");
    if (/^https?:\/\//g.exec(source) == null) {
      source = urlToPath(fileURL(source));
    }
    const isFile = url.startsWith('file://');
    const path = urlToPath(url);
    const type = getSourceType(source);
    contextMenu.append(new MenuItem({
      label: source,
      click: () => { navigator.clipboard.writeText(source); }
    }));
    contextMenu.append(new MenuItem({
      label: isFile ? path : url,
      click: () => { navigator.clipboard.writeText(isFile ? path : url); }
    }));
    if (url.toLocaleLowerCase().endsWith(".png") || url.toLocaleLowerCase().endsWith(".jpg") || url.toLocaleLowerCase().endsWith(".jpeg")) {
      contextMenu.append(new MenuItem({
        label: 'Copy Image',
        click: () => {
          this.copyImageToClipboard(url);
        }
      }));
    }
    contextMenu.append(new MenuItem({
      label: 'Open Source',
      click: () => { remote.shell.openExternal(source); }
    }));
    contextMenu.append(new MenuItem({
      label: 'Open File',
      click: () => { remote.shell.openExternal(url); }
    }));
    if (this.props.config.caching.enabled && type != ST.local) {
      contextMenu.append(new MenuItem({
        label: 'Open Cached Images',
        click: () => {
          // for some reason windows uses URLs and everyone else uses paths
          if (process.platform === "win32") {
            remote.shell.openExternal(getCachePath(source, this.props.config));
          } else {
            remote.shell.openExternal(urlToPath(getCachePath(source, this.props.config)));
          }
        }
      }));
    }
    if ((!isFile && type != ST.video) || type == ST.local) {
      contextMenu.append(new MenuItem({
        label: 'Blacklist File',
        click: () => {
          this.onBlacklistFile(source, isFile ? path : url);
        }
      }));
    }
    if (isFile) {
      contextMenu.append(new MenuItem({
        label: 'Reveal',
        click: () => {
          // for some reason windows uses URLs and everyone else uses paths
          if (process.platform === "win32") {
            remote.shell.showItemInFolder(url);
          } else {
            remote.shell.showItemInFolder(path);
          }
        }
      }));
      contextMenu.append(new MenuItem({
        label: 'Delete',
        click: () => {
          this.onDeletePath(path);
        }
      }));
    }
    if (!this.props.tags) {
      contextMenu.append(new MenuItem({
        label: 'Goto Tag Source',
        click: () => {
          this.props.goToTagSource(new LibrarySource({url: source}));
        }
      }));
    }
    contextMenu.popup({});
  };

  getKeyMap() {
    const keyMap = new Map<String, Array<string>>([
      ['playPause', ['Play/Pause ' + (this.props.isPlaying ? '(Playing)' : '(Paused)'), 'space']],
      ['historyBack', ['Back in Time', 'left']],
      ['historyForward', ['Forward in Time', 'right']],
      ['navigateBack', ['Go Back to Scene Details', 'escape']],
      ['toggleFullscreen', ['Toggle Fullscreen ' + (this.props.config.displaySettings.fullScreen ? '(On)' : '(Off)'), 'Control+F']],
      ['toggleAlwaysOnTop', ['Toggle Always On Top ' + (this.props.config.displaySettings.alwaysOnTop ? '(On)' : '(Off)'), 'Control+T']],
      ['toggleMenuBarDisplay', ['Toggle Menu Bar ' + (this.props.config.displaySettings.showMenu ? '(On)' : '(Off)'), 'Control+G']],
    ]);

    if (this.props.config.caching.enabled) {
      keyMap.set('onDelete', ['Delete Image', 'Delete']);
    }

    if (this.props.tags != null) {
      keyMap.set('prevSource', ['Previous Source', '[']);
      keyMap.set('nextSource', ['Next Source', ']']);
    }

    return keyMap;
  }

  onKeyDown = (e: KeyboardEvent) => {
    const focus = document.activeElement.tagName.toLocaleLowerCase();
    switch (e.key) {
      case ' ':
        if (!this.state.drawerHover || focus != "input") {
          e.preventDefault();
          this.playPause();
        }
        break;
      case 'ArrowLeft':
        if (!this.state.drawerHover || focus != "input") {
          e.preventDefault();
          this.historyBack();
        }
        break;
      case 'ArrowRight':
        if (!this.state.drawerHover || focus != "input") {
          e.preventDefault();
          this.historyForward();
        }
        break;
      case 'Escape':
        e.preventDefault();
        this.navigateBack();
        break;
      case 'c':
        if (e.ctrlKey) {
          e.preventDefault();
          this.copyImageToClipboard(null);
        }
        break;
      case 'f':
        if (e.ctrlKey) {
          e.preventDefault();
          this.toggleFullscreen();
        }
        break;
      case 't':
        if (e.ctrlKey) {
          e.preventDefault();
          this.toggleAlwaysOnTop();
        }
        break;
      case 'g':
        if (e.ctrlKey) {
          e.preventDefault();
          this.toggleMenuBarDisplay();
        }
        break;
      case 'Delete':
        if (!this.state.drawerHover || focus != "input") {
          if (this.props.config.caching.enabled) {
            e.preventDefault();
            this.onDelete();
          }
        }
        break;
      case '[':
        if (this.props.tags != null) {
          e.preventDefault();
          this.prevSource();
        }
        break;
      case ']':
        if (this.props.tags != null) {
          e.preventDefault();
          this.nextSource();
        }
        break;
    }
  };

  setPlayPause(play: boolean) {
    if (play) {
      this.props.play()
    } else {
      this.props.pause()
    }
    this.buildMenu();
  }

  setAlwaysOnTop(alwaysOnTop: boolean){
    this.props.config.displaySettings.alwaysOnTop = alwaysOnTop;
    this.buildMenu();
    getCurrentWindow().setAlwaysOnTop(alwaysOnTop);
  }

  navigateBack() {
    const window = getCurrentWindow();
    window.setFullScreen(false);
    window.setMenuBarVisibility(true);
    this.props.goBack();
  }

  copyImageToClipboard(sourceURL: string) {
    let url = sourceURL;
    if (!url) {
      url = this.props.historyPaths[(this.props.historyPaths.length - 1) + this.props.historyOffset].src;
    }
    const isFile = url.startsWith('file://');
    const path = urlToPath(url);
    const imagePath = isFile ? path : url;
    if (imagePath.toLocaleLowerCase().endsWith(".png") || imagePath.toLocaleLowerCase().endsWith(".jpg") || imagePath.toLocaleLowerCase().endsWith(".jpeg")) {
      clipboard.writeImage(nativeImage.createFromPath(imagePath));
    }
  }

  /* Menu and hotkey options DON'T DELETE */

  onDelete() {
    if (!this.state.drawerHover || document.activeElement.tagName.toLocaleLowerCase() != "input") {
      const img = this.props.historyPaths[(this.props.historyPaths.length - 1) + this.props.historyOffset];
      const url = img.src;
      const isFile = url.startsWith('file://');
      const path = urlToPath(url);
      if (isFile) {
        this.onDeletePath(path);
      }
    }
  }

  playPause() {
    if (!this.state.drawerHover || document.activeElement.tagName.toLocaleLowerCase() != "input") {
      this.setPlayPause(!this.props.isPlaying)
    }
  }

  toggleAlwaysOnTop() {
    this.setAlwaysOnTop(!this.props.config.displaySettings.alwaysOnTop);
  }

  toggleMenuBarDisplay() {
    this.setMenuBarVisibility(!this.props.config.displaySettings.showMenu);
  }

  toggleFullscreen() {
    this.setFullscreen(!this.props.config.displaySettings.fullScreen);
  }

  prevSource() {
    this.props.navigateTagging(-1);
  }

  nextSource() {
    this.props.navigateTagging(1);
  }
}

export default withStyles(styles)(PlayerBars as any);