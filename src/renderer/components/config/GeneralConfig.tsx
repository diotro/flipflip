import * as React from "react";

import {Card, CardContent, Grid, Theme} from "@material-ui/core";

import Config, {CacheSettings, DisplaySettings, RemoteSettings} from "../../data/Config";
import PlayerBoolCard from "../configGroups/PlayerBoolCard";
import PlayerNumCard from "../configGroups/PlayerNumCard";
import CacheCard from "../configGroups/CacheCard";
import BackupCard from "../configGroups/BackupCard";
import APICard from "../configGroups/APICard";
import ThemeCard from "../configGroups/ThemeCard";

export default class GeneralConfig extends React.Component {
  readonly props: {
    config: Config,
    theme: Theme,
    onBackup(): void,
    onChangeThemeColor(colorTheme: any, primary: boolean): void,
    onClean(): void,
    onRestore(backupFile: string): void,
    onToggleDarkMode(): void,
    onUpdateCachingSettings(fn: (settings: CacheSettings) => void): void,
    onUpdateDisplaySettings(fn: (settings: DisplaySettings) => void): void,
    onUpdateRemoteSettings(fn: (settings: RemoteSettings) => void): void,
    onUpdateConfig(fn: (config: Config) => void): void,
  };

  render() {
    return(
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <Card>
            <CardContent>
              <PlayerBoolCard
                settings={this.props.config.displaySettings}
                onUpdateSettings={this.props.onUpdateDisplaySettings.bind(this)}/>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4} md={3} lg={2}>
          <Card>
            <CardContent>
              <PlayerNumCard
                settings={this.props.config.displaySettings}
                onUpdateSettings={this.props.onUpdateDisplaySettings.bind(this)}/>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={8} md={5} lg={4}>
          <Card>
            <CardContent>
              <CacheCard
                config={this.props.config}
                onUpdateSettings={this.props.onUpdateCachingSettings.bind(this)}/>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4} md={3} lg={3}>
          <Card>
            <CardContent>
              <APICard
                settings={this.props.config.remoteSettings}
                onUpdateSettings={this.props.onUpdateRemoteSettings.bind(this)}
                onUpdateConfig={this.props.onUpdateConfig.bind(this)}/>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={"auto"}>
          <Card>
            <CardContent>
              <BackupCard
                onBackup={this.props.onBackup.bind(this)}
                onRestore={this.props.onRestore.bind(this)}
                onClean={this.props.onClean.bind(this)}/>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={"auto"}>
          <Card>
            <CardContent>
              <ThemeCard
                theme={this.props.theme}
                onChangeThemeColor={this.props.onChangeThemeColor.bind(this)}
                onToggleDarkMode={this.props.onToggleDarkMode.bind(this)} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  }
}