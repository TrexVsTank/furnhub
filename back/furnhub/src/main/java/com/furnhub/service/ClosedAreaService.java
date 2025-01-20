package com.furnhub.service;

import com.furnhub.entity.ClosedArea;

import java.util.List;

public interface ClosedAreaService {
    ClosedArea createClosedArea(ClosedArea closedArea);
    ClosedArea getClosedAreaById(Long id);
    List<ClosedArea> getAllClosedAreasByRoomId(Long roomId);
    ClosedArea updateClosedArea(Long id, ClosedArea updatedClosedArea);
    void deleteClosedArea(Long id);
}
