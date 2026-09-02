# ADR-022：MediaFile 永远属于 Private Layer

## 状态

Accepted · V1-10

## 决策

MediaFile 只能从 Private Library 读取和写入。Shared Pack 中不得提供用户本地路径状态。

`MediaFile.workId` 是 V1-10 起本地文件关联 Work 的主要方向，不要求把 MediaFile ID 回写进 Community Work。

## 原因

文件路径、文件大小、编码和本地 Hash 与某台机器有关，不属于可跨用户共享的作品公共事实。
