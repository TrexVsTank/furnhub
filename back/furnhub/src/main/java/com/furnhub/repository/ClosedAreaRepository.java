package com.furnhub.repository;

import com.furnhub.entity.ClosedArea;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ClosedAreaRepository extends JpaRepository<ClosedArea, Long> {
    List<ClosedArea> findByRoomId(Long roomId); // 추가
}
